const db = require('../models');

class AdminService {
  async getStats() {
    const [shopsTotal] = await db.sequelize.query('SELECT COUNT(*) AS total FROM shops', { type: db.sequelize.QueryTypes.SELECT });
    const [activeShops] = await db.sequelize.query('SELECT COUNT(*) AS total FROM shops WHERE is_active = 1', { type: db.sequelize.QueryTypes.SELECT });
    const [payingShops] = await db.sequelize.query(`SELECT COUNT(*) AS total FROM shops WHERE subscription_status = 'active'`, { type: db.sequelize.QueryTypes.SELECT });
    const [mrrData] = await db.sequelize.query(
      `SELECT COALESCE(SUM(p.price_monthly),0) AS mrr FROM shops s JOIN plans p ON p.id = s.plan_id WHERE s.subscription_status = 'active'`,
      { type: db.sequelize.QueryTypes.SELECT }
    );
    const recentShops = await db.sequelize.query(
      `SELECT s.id, s.name, s.phone, s.subscription_status, s.created_at FROM shops s ORDER BY s.created_at DESC LIMIT 10`,
      { type: db.sequelize.QueryTypes.SELECT }
    );

    return {
      totalShops: shopsTotal.total || 0,
      activeShops: activeShops.total || 0,
      payingShops: payingShops.total || 0,
      mrr: mrrData.mrr || 0,
      recentShops
    };
  }

  async getShops({ search = '', status }) {
    let whereClause = `(s.name LIKE :search OR s.phone LIKE :search)`;
    const replacements = { search: `%${search}%` };

    if (status) {
      whereClause += ` AND s.subscription_status = :status`;
      replacements.status = status;
    }

    const shops = await db.sequelize.query(
      `SELECT s.id, s.name, s.address, s.business_type, s.language_pref, s.phone,
              s.subscription_status, s.trial_ends_at, s.plan_ends_at, s.is_active, s.created_at,
              p.name AS plan_name,
              (SELECT COUNT(*) FROM customers c WHERE c.shop_id = s.id) AS customer_count
         FROM shops s LEFT JOIN plans p ON p.id = s.plan_id
        WHERE ${whereClause} ORDER BY s.created_at DESC`,
      { replacements, type: db.sequelize.QueryTypes.SELECT }
    );
    return shops;
  }

  async updateShop(shopId, data) {
    const updateData = {};
    if (data.isActive !== undefined) updateData.is_active = data.isActive ? 1 : 0;
    
    if (data.subscriptionStatus !== undefined) {
      if (!['trial', 'active', 'expired', 'locked'].includes(data.subscriptionStatus)) {
        throw { statusCode: 400, message: 'Invalid subscription status' };
      }
      updateData.subscription_status = data.subscriptionStatus;
    }

    if (data.planId !== undefined) {
      const plan = await db.Plan.findOne({ where: { id: data.planId } });
      if (!plan) throw { statusCode: 404, message: 'Plan not found' };
      updateData.plan_id = data.planId;
    }

    if (Object.keys(updateData).length === 0) return { message: 'Nothing to update' };

    await db.Shop.update(updateData, { where: { id: shopId } });
    return { message: 'Shop updated' };
  }

  async getPlans() {
    return await db.Plan.findAll({
      attributes: ['id', 'name', 'price_monthly', 'price_yearly', 'max_customers', 'trial_days'],
      order: [['id', 'ASC']]
    });
  }
}

module.exports = new AdminService();
