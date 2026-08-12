const db = require('../models');
const crypto = require('crypto');

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
      const customerCode = `${prefix}-${shopId}-${String(nextSeq).padStart(4, '0')}`;
      const qrCode = crypto.randomUUID().replace(/-/g, '');

      const customer = await db.Customer.create({
        shop_id: shopId,
        kind: data.kind || 'customer',
        customer_code: customerCode,
        name: data.name,
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
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.customCycleDays !== undefined) updateData.custom_cycle_days = data.customCycleDays;
    if (data.loanLimit !== undefined) updateData.loan_limit = data.loanLimit;

    if (Object.keys(updateData).length === 0) return { message: 'Nothing to update' };

    await db.Customer.update(updateData, { where: { id: customerId, shop_id: shopId } });
    return { message: 'Customer updated' };
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
        `SELECT id, amount, (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.loan_id = l.id AND t.type = 'payment') AS paid
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
        
        const totalPaid = Number(loan.paid) + apply;
        if (totalPaid >= Number(loan.amount)) {
          await db.Loan.update({ status: 'paid' }, { where: { id: loan.id }, transaction });
        }
      }

      await db.Transaction.create({
        shop_id: shopId,
        customer_id: customerId,
        type: 'payment',
        amount: amount,
        balance_after: newBalance,
        created_by: userId
      }, { transaction });

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
      `SELECT id, type, amount, balance_after, created_at FROM transactions WHERE shop_id = :shopId AND customer_id = :customerId ORDER BY created_at DESC`,
      { replacements: { shopId, customerId }, type: db.sequelize.QueryTypes.SELECT }
    );
    return { loans, transactions };
  }
}

module.exports = new CustomerService();
