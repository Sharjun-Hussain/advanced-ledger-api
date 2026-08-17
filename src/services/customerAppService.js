const db = require('../models');

class CustomerAppService {
  async getMyProfile(customerId) {
    const customer = await db.sequelize.query(
      `SELECT c.id, c.name, c.phone, c.customer_code, c.qr_code, c.type,
              c.custom_cycle_days, c.loan_limit, c.balance, c.is_locked,
              s.name AS shop_name, s.language_pref
         FROM customers c JOIN shops s ON s.id = c.shop_id WHERE c.id = :customerId`,
      { replacements: { customerId }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (!customer || customer.length === 0) return null;
    return customer[0];
  }

  async getMyTransactions(customerId) {
    const transactions = await db.sequelize.query(
      `SELECT t.id, t.type, t.amount, t.created_at, t.transaction_date, a.name as account_name
       FROM transactions t 
       JOIN accounts a ON a.id = t.account_id
       WHERE t.customer_id = :customerId 
         AND a.code = '1100' -- Only AR account
       ORDER BY COALESCE(t.transaction_date, t.created_at) ASC, t.id ASC`,
      { replacements: { customerId }, type: db.sequelize.QueryTypes.SELECT }
    );

    const customer = await db.sequelize.query(
      `SELECT opening_balance FROM customers WHERE id = :customerId`,
      { replacements: { customerId }, type: db.sequelize.QueryTypes.SELECT }
    );
    
    let balance = parseFloat(customer[0]?.opening_balance || 0);
    const ledger = transactions.map(t => {
      if (t.type === 'debit') {
        balance += parseFloat(t.amount);
      } else {
        balance -= parseFloat(t.amount);
      }
      return {
        ...t,
        balance_after: balance
      };
    });
    
    return ledger.reverse().slice(0, 100);
  }

  async getMyLoans(customerId) {
    return await db.sequelize.query(
      `SELECT id, amount, note, status, created_at FROM loans WHERE customer_id = :customerId ORDER BY created_at DESC LIMIT 100`,
      { replacements: { customerId }, type: db.sequelize.QueryTypes.SELECT }
    );
  }

  async getMySchedule(customerId) {
    const customer = await db.sequelize.query(
      `SELECT c.id, c.type, c.custom_cycle_days, c.balance,
              (SELECT MAX(created_at) FROM loans WHERE customer_id = c.id) AS last_loan_at
         FROM customers c WHERE c.id = :customerId`,
      { replacements: { customerId }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (!customer || customer.length === 0) return null;
    
    const cust = customer[0];
    const now = new Date();
    const nextDate = (() => {
      switch (cust.type) {
        case 'daily': return new Date(now.setDate(now.getDate() + 1));
        case 'weekly': return new Date(now.setDate(now.getDate() + 7));
        case 'monthly': return new Date(now.getFullYear(), now.getMonth() + 1, 1);
        case 'custom': return new Date(now.setDate(now.getDate() + (cust.custom_cycle_days || 7)));
        default: return new Date(now.setDate(now.getDate() + 1));
      }
    })();

    return {
      type: cust.type,
      custom_cycle_days: cust.custom_cycle_days,
      balance: cust.balance,
      next_payment_date: nextDate.toISOString().slice(0, 10),
    };
  }
}

module.exports = new CustomerAppService();
