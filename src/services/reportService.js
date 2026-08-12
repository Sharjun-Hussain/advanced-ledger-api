const db = require('../models');

class ReportService {
  async getSummary(shopId, fromDate, toDate) {
    const from = fromDate || '2000-01-01';
    const to = toDate || '2999-12-31';

    const [totals] = await db.sequelize.query(
      `SELECT
         (SELECT COALESCE(SUM(amount),0) FROM loans WHERE shop_id = :shopId AND DATE(created_at) BETWEEN :from AND :to) AS loans_issued,
         (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE shop_id = :shopId AND type = 'payment' AND DATE(created_at) BETWEEN :from AND :to) AS collected,
         (SELECT COALESCE(SUM(balance),0) FROM customers WHERE shop_id = :shopId AND is_active = 1) AS outstanding,
         (SELECT COUNT(*) FROM customers WHERE shop_id = :shopId AND is_active = 1 AND is_locked = 1) AS locked_accounts`,
      { replacements: { shopId, from, to }, type: db.sequelize.QueryTypes.SELECT }
    );

    const perCustomer = await db.sequelize.query(
      `SELECT c.id, c.name, c.customer_code,
              (SELECT COALESCE(SUM(l.amount),0) FROM loans l WHERE l.customer_id = c.id AND DATE(l.created_at) BETWEEN :from AND :to) AS issued,
              (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.customer_id = c.id AND t.type = 'payment' AND DATE(t.created_at) BETWEEN :from AND :to) AS paid,
              c.balance
         FROM customers c WHERE c.shop_id = :shopId AND c.is_active = 1 ORDER BY c.balance DESC`,
      { replacements: { shopId, from, to }, type: db.sequelize.QueryTypes.SELECT }
    );

    const dailyRows = await db.sequelize.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COALESCE(SUM(amount),0) AS total
         FROM transactions
        WHERE shop_id = :shopId AND type = 'payment' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`,
      { replacements: { shopId }, type: db.sequelize.QueryTypes.SELECT }
    );

    const dailyMap = {};
    for (const row of dailyRows) dailyMap[row.day] = Number(row.total);

    const dailyCollections = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyCollections.push({ day: key, total: dailyMap[key] || 0 });
    }

    return { summary: totals ? { ...totals, dailyCollections } : null, perCustomer };
  }

  async getExportData(shopId, fromDate, toDate) {
    const from = fromDate || '2000-01-01';
    const to = toDate || '2999-12-31';

    const rows = await db.sequelize.query(
      `SELECT c.customer_code, c.name, c.phone, c.type,
              (SELECT COALESCE(SUM(l.amount),0) FROM loans l WHERE l.customer_id = c.id AND DATE(l.created_at) BETWEEN :from AND :to) AS issued,
              (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.customer_id = c.id AND t.type = 'payment' AND DATE(t.created_at) BETWEEN :from AND :to) AS paid,
              c.balance, c.is_locked
         FROM customers c WHERE c.shop_id = :shopId AND c.is_active = 1 ORDER BY c.name`,
      { replacements: { shopId, from, to }, type: db.sequelize.QueryTypes.SELECT }
    );
    return rows;
  }
}

module.exports = new ReportService();
