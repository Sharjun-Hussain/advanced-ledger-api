const db = require('../models');
const { Cheque, Transaction, Account } = db;
const accountingService = require('../services/accountingService');
const { Op } = require('sequelize');

const getAllCheques = async (req, res, next) => {
    try {
        const { type, status, from_date, to_date } = req.query;
        const where = { shop_id: req.user.shop_id };
        if (type) where.type = type;
        if (status) where.status = status;
        if (from_date && to_date) {
            where.cheque_date = { [Op.between]: [from_date, to_date] };
        }

        const cheques = await Cheque.findAndCountAll({
            where,
            include: [
                { model: Account, as: 'account', attributes: ['name'] }
            ],
            order: [['cheque_date', 'ASC']]
        });

        return res.status(200).json({ success: true, data: cheques.rows, total: cheques.count, message: 'Cheques fetched successfully' });
    } catch (error) { next(error); }
};

const getChequeById = async (req, res, next) => {
    try {
        const cheque = await Cheque.findOne({
            where: { id: req.params.id, shop_id: req.user.shop_id },
            include: [{ model: Account, as: 'account' }]
        });
        if (!cheque) return res.status(404).json({ success: false, message: 'Cheque not found' });
        return res.status(200).json({ success: true, data: cheque, message: 'Cheque fetched successfully' });
    } catch (error) { next(error); }
};

const createCheque = async (req, res, next) => {
    try {
        const { shop_id } = req.user;
        const cheque = await Cheque.create({
            ...req.body,
            shop_id
        });
        return res.status(201).json({ success: true, data: cheque, message: 'Cheque recorded successfully' });
    } catch (error) { next(error); }
};

const updateChequeStatus = async (req, res, next) => {
    const t = await db.sequelize.transaction();
    try {
        const { id } = req.params;
        const { status, account_id, cleared_date, note } = req.body;

        const cheque = await Cheque.findOne({
            where: { id, shop_id: req.user.shop_id },
            transaction: t
        });

        if (!cheque) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Cheque not found' });
        }

        if (cheque.status === 'cleared' || cheque.status === 'cancelled') {
            await t.rollback();
            return res.status(400).json({ success: false, message: `Cannot update status from ${cheque.status}` });
        }

        await cheque.update({
            status,
            account_id: account_id || cheque.account_id,
            cleared_date: cleared_date || cheque.cleared_date,
            note: note || cheque.note
        }, { transaction: t });

        if (status === 'cleared') {
            const finalAccountId = account_id || cheque.account_id;
            if (!finalAccountId) {
                await t.rollback();
                return res.status(400).json({ success: false, message: 'Account ID is required for clearing a cheque' });
            }

            const bankAccount = await Account.findOne({
                where: { id: finalAccountId, shop_id: req.user.shop_id },
                transaction: t
            });
            if (!bankAccount) {
                await t.rollback();
                return res.status(404).json({ success: false, message: 'Bank Account not found' });
            }

            const offsetAccountCode = cheque.type === 'receivable' ? '1050' : '2110'; 
            const offsetAccountName = cheque.type === 'receivable' ? 'Cheques in Hand' : 'Cheques Payable';
            const offsetAccountType = cheque.type === 'receivable' ? 'asset' : 'liability';

            const [offsetAccount] = await Account.findOrCreate({
                where: { shop_id: cheque.shop_id, code: offsetAccountCode },
                defaults: { name: offsetAccountName, type: offsetAccountType },
                transaction: t
            });

            if (cheque.type === 'receivable') {
                await accountingService.recordTransaction({
                    shop_id: cheque.shop_id,
                    account_id: bankAccount.id,
                    amount: cheque.amount,
                    type: 'debit',
                    reference_type: 'Cheque',
                    reference_id: cheque.id,
                    transaction_date: cleared_date || new Date(),
                    description: `Cheque Cleared: ${cheque.cheque_number} (${cheque.bank_name})`
                }, t);

                await accountingService.recordTransaction({
                    shop_id: cheque.shop_id,
                    account_id: offsetAccount.id,
                    amount: cheque.amount,
                    type: 'credit',
                    reference_type: 'Cheque',
                    reference_id: cheque.id,
                    transaction_date: cleared_date || new Date(),
                    description: `Cheque Cleared: ${cheque.cheque_number}`
                }, t);
            } else {
                await accountingService.recordTransaction({
                    shop_id: cheque.shop_id,
                    account_id: offsetAccount.id,
                    amount: cheque.amount,
                    type: 'debit', 
                    reference_type: 'Cheque',
                    reference_id: cheque.id,
                    transaction_date: cleared_date || new Date(),
                    description: `Cheque Cleared: ${cheque.cheque_number} (${cheque.bank_name})`
                }, t);

                await accountingService.recordTransaction({
                    shop_id: cheque.shop_id,
                    account_id: bankAccount.id,
                    amount: cheque.amount,
                    type: 'credit', 
                    reference_type: 'Cheque',
                    reference_id: cheque.id,
                    transaction_date: cleared_date || new Date(),
                    description: `Cheque Cleared: ${cheque.cheque_number}`
                }, t);
            }

        } else if (status === 'bounced') {
            const offsetAccountCode = cheque.type === 'receivable' ? '1050' : '2110';
            const offsetAccountName = cheque.type === 'receivable' ? 'Cheques in Hand' : 'Cheques Payable';
            const offsetAccountType = cheque.type === 'receivable' ? 'asset' : 'liability';

            const [offsetAccount] = await Account.findOrCreate({
                where: { shop_id: cheque.shop_id, code: offsetAccountCode },
                defaults: { name: offsetAccountName, type: offsetAccountType },
                transaction: t
            });

            let customer_id = null;
            if (cheque.reference_id) {
                const linkedTx = await Transaction.findOne({
                    where: { id: cheque.reference_id, shop_id: req.user.shop_id },
                    transaction: t
                });
                if (linkedTx) customer_id = linkedTx.customer_id;
            }

            if (cheque.type === 'receivable') {
                const [arAccount] = await Account.findOrCreate({
                    where: { shop_id: cheque.shop_id, code: '1100' },
                    defaults: { name: 'Accounts Receivable', type: 'asset' },
                    transaction: t
                });

                await accountingService.recordTransaction({
                    shop_id: cheque.shop_id,
                    account_id: arAccount.id,
                    customer_id,
                    amount: cheque.amount,
                    type: 'debit', 
                    reference_type: 'Cheque',
                    reference_id: cheque.id,
                    transaction_date: new Date(),
                    description: `Cheque Bounced: ${cheque.cheque_number} - Payment Reversed`
                }, t);

                await accountingService.recordTransaction({
                    shop_id: cheque.shop_id,
                    account_id: offsetAccount.id,
                    amount: cheque.amount,
                    type: 'credit', 
                    reference_type: 'Cheque',
                    reference_id: cheque.id,
                    transaction_date: new Date(),
                    description: `Cheque Bounced: ${cheque.cheque_number}`
                }, t);
            } else {
                const [apAccount] = await Account.findOrCreate({
                    where: { shop_id: cheque.shop_id, code: '2100' },
                    defaults: { name: 'Accounts Payable', type: 'liability' },
                    transaction: t
                });

                await accountingService.recordTransaction({
                    shop_id: cheque.shop_id,
                    account_id: offsetAccount.id, 
                    amount: cheque.amount,
                    type: 'debit', 
                    reference_type: 'Cheque',
                    reference_id: cheque.id,
                    transaction_date: new Date(),
                    description: `Cheque Bounced: ${cheque.cheque_number}`
                }, t);

                await accountingService.recordTransaction({
                    shop_id: cheque.shop_id,
                    account_id: apAccount.id,
                    customer_id,
                    amount: cheque.amount,
                    type: 'credit', 
                    reference_type: 'Cheque',
                    reference_id: cheque.id,
                    transaction_date: new Date(),
                    description: `Cheque Bounced: ${cheque.cheque_number} - Payment Reversed`
                }, t);
            }
        }

        await t.commit();
        return res.status(200).json({ success: true, data: cheque, message: `Cheque marked as ${status}` });
    } catch (error) {
        await t.rollback();
        next(error);
    }
};

const deleteCheque = async (req, res, next) => {
    try {
        const cheque = await Cheque.findOne({
            where: { id: req.params.id, shop_id: req.user.shop_id }
        });
        if (!cheque) return res.status(404).json({ success: false, message: 'Cheque not found' });

        if (cheque.status === 'cleared') {
            return res.status(400).json({ success: false, message: 'Cannot delete a cleared cheque' });
        }

        await cheque.destroy();
        return res.status(200).json({ success: true, message: 'Cheque deleted successfully' });
    } catch (error) { next(error); }
};

module.exports = {
    getAllCheques,
    getChequeById,
    createCheque,
    updateChequeStatus,
    deleteCheque
};
