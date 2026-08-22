const db = require('../models');
const { sendSms } = require('../utils/sms');
const accountingService = require('./accountingService');

class LoanService {
  async getLoans(shopId, { customerId, status }) {
    let whereClause = `l.shop_id = :shopId`;
    const replacements = { shopId };

    if (customerId) {
      whereClause += ` AND l.customer_id = :customerId`;
      replacements.customerId = Number(customerId);
    }
    if (status) {
      whereClause += ` AND l.status = :status`;
      replacements.status = status;
    }

    const loans = await db.sequelize.query(
      `SELECT l.id, l.amount, l.note, l.status, l.created_at, c.name AS customer_name, c.customer_code
         FROM loans l JOIN customers c ON c.id = l.customer_id
        WHERE ${whereClause} ORDER BY l.created_at DESC LIMIT 200`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    );
    return loans;
  }

  async addLoan(shopId, userId, data) {
    const customer = await db.Customer.findOne({ where: { id: data.customerId, shop_id: shopId } });
    if (!customer) throw { statusCode: 404, message: 'Customer not found' };
    if (customer.is_locked) throw { statusCode: 409, message: 'Customer account is locked' };
    
    if (Number(customer.balance) + Number(data.amount) > Number(customer.loan_limit) && Number(customer.loan_limit) > 0) {
      throw { statusCode: 409, message: 'Loan limit would be exceeded' };
    }

    const transaction = await db.sequelize.transaction();
    try {
      const loan = await db.Loan.create({
        shop_id: shopId,
        customer_id: data.customerId,
        amount: data.amount,
        note: data.note,
        created_by: userId,
        status: 'active'
      }, { transaction });

      const newBalance = Number(customer.balance) + Number(data.amount);
      const isLocked = (newBalance >= Number(customer.loan_limit) && Number(customer.loan_limit) > 0);
      
      await customer.update({ balance: newBalance, is_locked: isLocked }, { transaction });

      await db.sequelize.query(
        `INSERT INTO legacy_transactions (shop_id, customer_id, loan_id, type, amount, balance_after, created_by, created_at)
         VALUES (:shop_id, :customer_id, :loan_id, :type, :amount, :balance_after, :created_by, :created_at)`,
        {
          replacements: { shop_id: shopId, customer_id: data.customerId, loan_id: loan.id, type: 'loan', amount: data.amount, balance_after: newBalance, created_by: userId || null, created_at: new Date() }, transaction
        }
      );

      const [arAccount] = await db.Account.findOrCreate({ where: { shop_id: shopId, code: '1100' }, defaults: { name: 'Accounts Receivable', type: 'asset' }, transaction });
      const [revenueAccount] = await db.Account.findOrCreate({ where: { shop_id: shopId, code: '4000' }, defaults: { name: 'Sales Revenue', type: 'revenue' }, transaction });

      await accountingService.recordTransaction({
        shop_id: shopId, account_id: arAccount.id, customer_id: data.customerId, amount: data.amount, type: 'debit', reference_type: 'Loan', reference_id: loan.id.toString(), transaction_date: new Date(), description: `Credit Sale to ${customer.name}`
      }, transaction);
      await accountingService.recordTransaction({
        shop_id: shopId, account_id: revenueAccount.id, customer_id: data.customerId, amount: data.amount, type: 'credit', reference_type: 'Loan', reference_id: loan.id.toString(), transaction_date: new Date(), description: `Store Credit Issued to ${customer.name} (Revenue)`
      }, transaction);

      await transaction.commit();
      
      // Note: SMS Notifications have been delegated to loanController via textLkService

      return { id: loan.id, balance: newBalance };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async recordLoanPayment(shopId, loanId, userId, amount) {
    const transaction = await db.sequelize.transaction();
    try {
      const loan = await db.Loan.findOne({
        where: { id: loanId, shop_id: shopId, status: 'active' },
        include: [{ model: db.Customer, as: 'customer' }],
        transaction
      });
      if (!loan) throw { statusCode: 404, message: 'Active loan not found' };

      const newBalance = Math.max(0, Number(loan.customer.balance) - amount);
      await loan.customer.update({ balance: newBalance, is_locked: false }, { transaction });

      await db.sequelize.query(
        `INSERT INTO legacy_transactions (shop_id, customer_id, loan_id, type, amount, balance_after, created_by, created_at)
         VALUES (:shop_id, :customer_id, :loan_id, :type, :amount, :balance_after, :created_by, :created_at)`,
        {
          replacements: { shop_id: shopId, customer_id: loan.customer_id, loan_id: loanId, type: 'payment', amount: amount, balance_after: newBalance, created_by: userId || null, created_at: new Date() }, transaction
        }
      );

      const [arAccount] = await db.Account.findOrCreate({ where: { shop_id: shopId, code: '1100' }, defaults: { name: 'Accounts Receivable', type: 'asset' }, transaction });
      const [cashAccount] = await db.Account.findOrCreate({ where: { shop_id: shopId, code: '1000' }, defaults: { name: 'Cash', type: 'asset' }, transaction });
      
      await accountingService.recordTransaction({
        shop_id: shopId, account_id: arAccount.id, customer_id: loan.customer_id, amount: amount, type: 'credit', reference_type: 'Loan Payment', reference_id: loan.id.toString(), transaction_date: new Date(), description: `Loan Repayment from ${loan.customer.name}`
      }, transaction);
      await accountingService.recordTransaction({
        shop_id: shopId, account_id: cashAccount.id, customer_id: loan.customer_id, amount: amount, type: 'debit', reference_type: 'Loan Payment', reference_id: loan.id.toString(), transaction_date: new Date(), description: `Loan Repayment from ${loan.customer.name} (Cash)`
      }, transaction);

      const [{ total }] = await db.sequelize.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM legacy_transactions WHERE loan_id = :loanId AND type = 'payment'`,
        { replacements: { loanId }, type: db.sequelize.QueryTypes.SELECT, transaction }
      );

      if (Number(total) >= Number(loan.amount)) {
        await loan.update({ status: 'paid' }, { transaction });
      }

      await transaction.commit();
      return { balance: newBalance, paid: Number(total), customer_id: loan.customer_id };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new LoanService();
