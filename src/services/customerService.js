const db = require('../models');
const crypto = require('crypto');
const accountingService = require('./accountingService');

class CustomerService {
  async getCustomers(shopId, { search = '', page = 1, limit = 50, kind = 'customer', qr }) {
    if (qr) {
      const customer = await db.Customer.findOne({
        where: { shop_id: shopId, qr_code: qr },
        attributes: ['id', 'customer_code', 'name', 'phone', 'type', 'loan_limit', 'balance', 'is_locked', 'is_active']
      });
      if (!customer) throw { statusCode: 404, message: 'Customer not found for this QR code' };
      return [customer];
    }

    const { Op } = require('sequelize');
    const offset = (Number(page) - 1) * Number(limit);

    const customers = await db.Customer.findAll({
      where: {
        shop_id: shopId,
        kind,
        is_active: true,
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { phone: { [Op.like]: `%${search}%` } },
          { customer_code: { [Op.like]: `%${search}%` } }
        ]
      },
      attributes: ['id', 'customer_code', 'name', 'phone', 'type', 'loan_limit', 'balance', 'is_locked', 'is_active', 'created_at'],
      order: [['name', 'ASC']],
      limit: Number(limit),
      offset
    });

    return customers;
  }

  async addCustomer(shopId, data) {
    const transaction = await db.sequelize.transaction();
    try {
      const [seqResult] = await db.sequelize.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(customer_code, '-', -1) AS UNSIGNED)), 0) + 1 AS next_seq FROM customers WHERE shop_id = :shopId`,
        { replacements: { shopId }, type: db.sequelize.QueryTypes.SELECT, transaction }
      );
      const nextSeq = seqResult.next_seq;
      const prefix = data.kind === 'distributor' ? 'D' : 'C';
      const customerCode = data.customerCode && data.customerCode.trim() !== ''
        ? data.customerCode.trim()
        : `${prefix}-${shopId}-${String(nextSeq).padStart(4, '0')}`;
      const qrCode = crypto.randomUUID().replace(/-/g, '');

      const customer = await db.Customer.create({
        shop_id: shopId,
        kind: data.kind || 'customer',
        customer_code: customerCode,
        name: data.name,
        nic: data.nic,
        phone: data.phone,
        qr_code: qrCode,
        type: data.type,
        custom_cycle_days: data.customCycleDays,
        loan_limit: data.loanLimit || 0
      }, { transaction });

      await transaction.commit();
      return { id: customer.id, customer_code: customer.customer_code, qr_code: customer.qr_code };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getCustomer(shopId, customerId) {
    const customer = await db.Customer.findOne({ where: { id: customerId, shop_id: shopId } });
    if (!customer) throw { statusCode: 404, message: 'Customer not found' };
    return customer;
  }

  async updateCustomer(shopId, customerId, data) {
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.customerCode !== undefined) updateData.customer_code = data.customerCode;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.nic !== undefined) updateData.nic = data.nic;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.customCycleDays !== undefined) updateData.custom_cycle_days = data.customCycleDays;
    if (data.loanLimit !== undefined) updateData.loan_limit = data.loanLimit;

    if (Object.keys(updateData).length === 0) return { message: 'Nothing to update' };

    await db.Customer.update(updateData, { where: { id: customerId, shop_id: shopId } });
    return { message: 'Customer updated' };
  }

  async deleteCustomer(shopId, customerId) {
    const customer = await db.Customer.findOne({
      where: { id: customerId, shop_id: shopId }
    });
    if (!customer) throw { statusCode: 404, message: 'Customer not found' };

    if (Number(customer.balance) > 0) {
      throw { statusCode: 400, message: 'Cannot delete a customer with an active outstanding balance' };
    }

    await customer.update({ is_active: false });
    return { message: 'Customer deleted successfully' };
  }

  async lockCustomer(shopId, customerId, locked) {
    await db.Customer.update({ is_locked: locked ? 1 : 0 }, { where: { id: customerId, shop_id: shopId } });
    return { message: locked ? 'Account locked' : 'Account unlocked' };
  }

  async recordPayment(shopId, customerId, userId, amount) {
    const transaction = await db.sequelize.transaction();
    try {
      const customer = await db.Customer.findOne({
        where: { id: customerId, shop_id: shopId },
        transaction
      });
      if (!customer) throw { statusCode: 404, message: 'Customer not found' };

      const newBalance = Math.max(0, Number(customer.balance) - amount);
      await customer.update({ balance: newBalance, is_locked: false }, { transaction });

      const loans = await db.sequelize.query(
        `SELECT id, amount, (SELECT COALESCE(SUM(t.amount),0) FROM legacy_transactions t WHERE t.loan_id = l.id AND t.type = 'payment') AS paid
         FROM loans l WHERE l.customer_id = :customerId AND l.shop_id = :shopId AND l.status = 'active'
         ORDER BY l.created_at ASC`,
        { replacements: { customerId, shopId }, type: db.sequelize.QueryTypes.SELECT, transaction }
      );

      let remaining = amount;
      for (const loan of loans) {
        if (remaining <= 0) break;
        const owed = Number(loan.amount) - Number(loan.paid);
        if (owed <= 0) continue;
        
        const apply = Math.min(owed, remaining);
        remaining -= apply;

        await db.sequelize.query(
          `INSERT INTO legacy_transactions (shop_id, customer_id, loan_id, type, amount, balance_after, created_by, created_at)
           VALUES (:shopId, :customerId, :loanId, 'payment', :amount, :balanceAfter, :userId, :createdAt)`,
          {
            replacements: { shopId, customerId, loanId: loan.id, amount: apply, balanceAfter: Math.max(0, Number(customer.balance) - (amount - remaining)), userId: userId || null, createdAt: new Date() }, transaction
          }
        );

        const totalPaid = Number(loan.paid) + apply;
        if (totalPaid >= Number(loan.amount)) {
          await db.Loan.update({ status: 'paid' }, { where: { id: loan.id }, transaction });
        }
      }

      // 1. Get AR Account
      const [arAccount] = await db.Account.findOrCreate({
        where: { shop_id: shopId, code: '1100' },
        defaults: { name: 'Accounts Receivable', type: 'asset' },
        transaction
      });

      // 2. Get Cash Account
      const [cashAccount] = await db.Account.findOrCreate({
        where: { shop_id: shopId, code: '1000' },
        defaults: { name: 'Cash', type: 'asset' },
        transaction
      });

      // 3. Record Accounting Transactions (Credit AR, Debit Cash)
      await accountingService.recordTransaction({
        shop_id: shopId,
        account_id: arAccount.id,
        customer_id: customerId,
        amount: amount,
        type: 'credit',
        reference_type: 'Payment',
        transaction_date: new Date(),
        description: `Loan Payment from ${customer.name}`
      }, transaction);

      await accountingService.recordTransaction({
        shop_id: shopId,
        account_id: cashAccount.id,
        customer_id: customerId,
        amount: amount,
        type: 'debit',
        reference_type: 'Payment',
        transaction_date: new Date(),
        description: `Loan Payment from ${customer.name} (Cash)`
      }, transaction);

      await transaction.commit();
      return { balance: newBalance };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getCustomerHistory(shopId, customerId) {
    const loans = await db.sequelize.query(
      `SELECT id, amount, note, status, created_at FROM loans WHERE shop_id = :shopId AND customer_id = :customerId ORDER BY created_at DESC`,
      { replacements: { shopId, customerId }, type: db.sequelize.QueryTypes.SELECT }
    );
    const transactions = await db.sequelize.query(
      // Ensure the mobile UI receives legacy syntax ('loan', 'payment')
      `SELECT id, type, amount, created_at, balance_after AS balance, loan_id, 'Legacy' AS reference_type FROM legacy_transactions WHERE shop_id = :shopId AND customer_id = :customerId ORDER BY created_at DESC`,
      { replacements: { shopId, customerId }, type: db.sequelize.QueryTypes.SELECT }
    );
    return { loans, transactions };
  }
}

module.exports = new CustomerService();
