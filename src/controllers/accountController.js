const db = require('../models');
const { Account, Transaction, Customer } = db;
const accountingService = require('../services/accountingService');

const getAllAccounts = async (req, res, next) => {
    try {
        const { type, is_active } = req.query;
        const shop_id = req.user.shop_id;

        const where = { shop_id };
        if (type) where.type = type;
        if (is_active !== undefined) where.is_active = is_active === 'true';

        const accounts = await Account.findAll({
            where,
            order: [['code', 'ASC']]
        });

        return res.status(200).json({ success: true, data: accounts, message: 'Accounts fetched successfully' });
    } catch (error) {
        next(error);
    }
};

const createAccount = async (req, res, next) => {
    try {
        const shop_id = req.user.shop_id;
        const { name, code, type, balance } = req.body;

        if (!name || !code || !type) {
            return res.status(400).json({ success: false, message: 'name, code and type are required' });
        }
        const allowedTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
        if (!allowedTypes.includes(type)) {
            return res.status(400).json({ success: false, message: `type must be one of: ${allowedTypes.join(', ')}` });
        }

        const existingAccount = await Account.findOne({
            where: { shop_id, code }
        });

        if (existingAccount) {
            return res.status(400).json({ success: false, message: 'Account code already exists' });
        }

        const account = await Account.create({
            shop_id,
            name,
            code,
            type,
            balance: balance || 0.00
        });

        return res.status(201).json({ success: true, data: account, message: 'Account created successfully' });
    } catch (error) {
        next(error);
    }
};

const updateAccount = async (req, res, next) => {
    try {
        const { id } = req.params;
        const shop_id = req.user.shop_id;

        const account = await Account.findOne({
            where: { id, shop_id }
        });

        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        // Whitelist updatable fields — prevents mass-assignment of shop_id/balance/id.
        const { name, code, type, is_active } = req.body;
        const patch = {};
        if (name !== undefined) patch.name = name;
        if (code !== undefined) patch.code = code;
        if (type !== undefined) {
            const allowedTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
            if (!allowedTypes.includes(type)) {
                return res.status(400).json({ success: false, message: `type must be one of: ${allowedTypes.join(', ')}` });
            }
            patch.type = type;
        }
        if (is_active !== undefined) patch.is_active = is_active;
        await account.update(patch);

        return res.status(200).json({ success: true, data: account, message: 'Account updated successfully' });
    } catch (error) {
        next(error);
    }
};

const getAccountLedger = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { from_date, to_date } = req.query;
        const shop_id = req.user.shop_id;

        const account = await Account.findOne({
            where: { id, shop_id }
        });

        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        const where = { account_id: id, shop_id };
        if (from_date && to_date) {
            where.transaction_date = {
                [db.Sequelize.Op.between]: [new Date(from_date), new Date(to_date)]
            };
        }

        const transactions = await Transaction.findAndCountAll({
            where,
            include: [
                { model: Customer, as: 'customer', attributes: ['name'] }
            ],
            order: [['transaction_date', 'DESC']]
        });

        return res.status(200).json({ success: true, data: transactions.rows, total: transactions.count, message: 'Account ledger fetched successfully' });
    } catch (error) {
        next(error);
    }
};

const setOpeningBalance = async (req, res, next) => {
    const t = await db.sequelize.transaction();
    try {
        const { id } = req.params;
        const { balance, date } = req.body;
        const shop_id = req.user.shop_id;

        const numericBalance = Number(balance);
        if (!Number.isFinite(numericBalance)) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'balance must be a number' });
        }

        const account = await Account.findOne({
            where: { id, shop_id },
            transaction: t
        });

        if (!account) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        let transactionType;
        if (numericBalance >= 0) {
            transactionType = (['asset', 'expense'].includes(account.type)) ? 'debit' : 'credit';
        } else {
            transactionType = (['asset', 'expense'].includes(account.type)) ? 'credit' : 'debit';
        }

        const absAmount = Math.abs(numericBalance);
        await accountingService.recordTransaction({
            shop_id,
            account_id: account.id,
            amount: absAmount,
            type: transactionType,
            reference_type: 'Opening Balance',
            transaction_date: date || new Date(),
            description: `Opening Balance for ${account.name}`
        }, t);

        // Post the offsetting leg so the journal balances (equity 3900).
        const [equityAccount] = await Account.findOrCreate({
            where: { shop_id, code: '3900' },
            defaults: { name: 'Opening Balance Equity', type: 'equity' },
            transaction: t
        });
        const offsetType = transactionType === 'debit' ? 'credit' : 'debit';
        await accountingService.recordTransaction({
            shop_id,
            account_id: equityAccount.id,
            amount: absAmount,
            type: offsetType,
            reference_type: 'Opening Balance',
            transaction_date: date || new Date(),
            description: `Opening Balance offset for ${account.name}`
        }, t);

        await t.commit();
        return res.status(200).json({ success: true, data: account, message: 'Opening balance set successfully' });
    } catch (error) {
        if (t) await t.rollback();
        next(error);
    }
};

const transferFunds = async (req, res, next) => {
    const t = await db.sequelize.transaction();
    try {
        const { from_account_id, to_account_id, amount, date, description } = req.body;
        const shop_id = req.user.shop_id;

        if (from_account_id === to_account_id) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'Source and destination accounts must be different' });
        }

        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'amount must be a positive number' });
        }

        const fromAccount = await Account.findOne({ where: { id: from_account_id, shop_id }, transaction: t });
        const toAccount = await Account.findOne({ where: { id: to_account_id, shop_id }, transaction: t });

        if (!fromAccount || !toAccount) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'One or both accounts not found' });
        }

        await accountingService.recordTransaction({
            shop_id,
            account_id: fromAccount.id,
            amount: numericAmount,
            type: 'credit',
            reference_type: 'Transfer',
            transaction_date: date || new Date(),
            description: description || `Transfer to ${toAccount.name}`
        }, t);

        await accountingService.recordTransaction({
            shop_id,
            account_id: toAccount.id,
            amount: numericAmount,
            type: 'debit',
            reference_type: 'Transfer',
            transaction_date: date || new Date(),
            description: description || `Transfer from ${fromAccount.name}`
        }, t);

        await t.commit();
        return res.status(200).json({ success: true, message: 'Funds transferred successfully' });
    } catch (error) {
        if (t) await t.rollback();
        next(error);
    }
};

const createJournalEntry = async (req, res, next) => {
    const t = await db.sequelize.transaction();
    try {
        const { date, description, entries, customer_id } = req.body; 
        const shop_id = req.user.shop_id;

        if (!entries || entries.length < 2) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'At least two entries are required for a journal' });
        }

        // Verify every account belongs to this shop before posting.
        const accountIds = [...new Set(entries.map((e) => e.account_id))];
        const owned = await Account.count({ where: { id: accountIds, shop_id }, transaction: t });
        if (owned !== accountIds.length) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'One or more accounts not found for this shop' });
        }
        if (customer_id) {
            const cust = await Customer.findOne({ where: { id: customer_id, shop_id }, transaction: t });
            if (!cust) {
                await t.rollback();
                return res.status(404).json({ success: false, message: 'Customer not found for this shop' });
            }
        }

        let totalDebit = 0;
        let totalCredit = 0;

        for (const entry of entries) {
            const amount = parseFloat(entry.amount);
            if (entry.type === 'debit') totalDebit += amount;
            else if (entry.type === 'credit') totalCredit += amount;
        }

        if (totalDebit.toFixed(2) !== totalCredit.toFixed(2)) {
            await t.rollback();
            return res.status(400).json({ success: false, message: `Journal does not balance. Total Debit: ${totalDebit.toFixed(2)}, Total Credit: ${totalCredit.toFixed(2)}` });
        }

        await accountingService.createDoubleEntry(shop_id, entries, {
            date,
            description: description || 'Manual Journal Entry',
            reference_type: 'Journal Entry',
            customer_id
        }, t);

        await t.commit();
        return res.status(201).json({ success: true, message: 'Journal entry recorded successfully' });
    } catch (error) {
        if (t) await t.rollback();
        next(error);
    }
};

module.exports = {
    getAllAccounts,
    createAccount,
    updateAccount,
    getAccountLedger,
    setOpeningBalance,
    transferFunds,
    createJournalEntry
};
