const db = require('../models');
const bcrypt = require('bcryptjs');

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

  async createShop(data) {
    const existingShop = await db.Shop.findOne({ where: { phone: data.phone } });
    if (existingShop) {
      throw { statusCode: 409, message: 'Phone already registered to a shop' };
    }

    const transaction = await db.sequelize.transaction();
    try {
      const shop = await db.Shop.create({
        name: data.name,
        address: data.address,
        business_type: data.business_type,
        language_pref: data.language_pref || 'sinhala',
        phone: data.phone,
        subscription_status: data.subscription_status || 'trial',
        plan_id: data.plan_id || null,
        is_active: data.is_active !== undefined ? data.is_active : true
      }, { transaction });

      if (data.owner_name && data.password) {
        const hash = await bcrypt.hash(data.password, 10);
        await db.User.create({
          shop_id: shop.id,
          name: data.owner_name,
          phone: data.phone,
          nic: data.owner_nic,
          password_hash: hash,
          role: 'owner',
        }, { transaction });
      }

      await transaction.commit();
      return shop;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteShop(shopId) {
    const transaction = await db.sequelize.transaction();
    try {
      await db.User.destroy({ where: { shop_id: shopId }, transaction });
      const deleted = await db.Shop.destroy({ where: { id: shopId }, transaction });
      if (!deleted) throw { statusCode: 404, message: 'Shop not found' };
      
      await transaction.commit();
      return { message: 'Shop deleted successfully' };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new AdminService();
