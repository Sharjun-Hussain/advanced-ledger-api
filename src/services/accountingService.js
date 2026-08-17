const db = require('../models');
const { Transaction, Account } = db;

/**
 * Accounting Service (LedgerLK Adjusted)
 */
class AccountingService {
    async recordTransaction(data, transaction = null) {
        const {
            shop_id,
            account_id,
            amount,
            type, // 'debit' or 'credit'
            reference_type,
            reference_id,
            customer_id,
            transaction_date,
            description
        } = data;

        if (!amount || amount <= 0) {
            throw new Error(`Transaction amount must be a positive number. Received: ${amount}`);
        }

        const account = await Account.findByPk(account_id, { transaction });
        if (!account) {
            throw new Error(`Account with ID ${account_id} not found`);
        }

        const record = await Transaction.create({
            shop_id,
            account_id,
            amount,
            type,
            reference_type,
            reference_id,
            customer_id: customer_id || null,
            transaction_date: transaction_date || new Date(),
            description
        }, { transaction });

        const isIncrease = (
            (['asset', 'expense'].includes(account.type) && type === 'debit') ||
            (['liability', 'equity', 'revenue'].includes(account.type) && type === 'credit')
        );

        if (isIncrease) {
            await account.increment('balance', { by: amount, transaction });
        } else {
            await account.decrement('balance', { by: amount, transaction });
        }

        return record;
    }

    async createDoubleEntry(shop_id, entries, metadata, transaction = null) {
        const { date, description, reference_type, reference_id, customer_id } = metadata;

        let totalDebit = 0;
        let totalCredit = 0;

        for (const entry of entries) {
            const amount = parseFloat(entry.amount);
            if (entry.type === 'debit') totalDebit += amount;
            else if (entry.type === 'credit') totalCredit += amount;
        }

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Transaction does not balance. Total Debit: ${totalDebit.toFixed(2)}, Total Credit: ${totalCredit.toFixed(2)}`);
        }

        const results = [];
        for (const entry of entries) {
            const result = await this.recordTransaction({
                shop_id,
                account_id: entry.account_id,
                amount: entry.amount,
                type: entry.type,
                reference_type,
                reference_id,
                customer_id,
                transaction_date: date,
                description: entry.description || description
            }, transaction);
            results.push(result);
        }

        return results;
    }
 
    async getCustomerBalance(shop_id, customer_id, transaction = null) {
        const arAccount = await Account.findOne({
            where: { shop_id, code: '1100' },
            transaction
        });
        if (!arAccount) return 0;
 
        const totals = await Transaction.findAll({
            attributes: [
                'type',
                [db.Sequelize.fn('SUM', db.Sequelize.col('amount')), 'total']
            ],
            where: { shop_id, customer_id, account_id: arAccount.id },
            group: ['type'],
            transaction
        });
 
        let balance = 0;
        totals.forEach(t => {
            const amount = parseFloat(t.get('total') || 0);
            if (t.type === 'debit') balance += amount;
            else balance -= amount;
        });
 
        const customer = await db.Customer.findByPk(customer_id, { transaction });
        if (customer) {
            balance += parseFloat(customer.balance || 0); // LedgerLK customer uses "balance" instead of opening_balance
        }
 
        return balance;
    }
}

module.exports = new AccountingService();
