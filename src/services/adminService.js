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

  async getShops({ search = '', status, page = 1, size = 10 }) {
    const limit = Math.max(1, parseInt(size) || 10);
    const offset = (Math.max(1, parseInt(page) || 1) - 1) * limit;

    let whereClause = `(s.name LIKE :search OR s.phone LIKE :search)`;
    const replacements = { search: `%${search}%` };

    if (status) {
      whereClause += ` AND s.subscription_status = :status`;
      replacements.status = status;
    }

    const [[{ total }]] = await db.sequelize.query(
      `SELECT COUNT(*) AS total FROM shops s WHERE ${whereClause}`,
      { replacements }
    );

    const shops = await db.sequelize.query(
      `SELECT s.id, s.name, s.address, s.business_type, s.language_pref, s.phone,
              s.subscription_status, s.trial_ends_at, s.plan_ends_at, s.is_active, s.created_at,
              p.name AS plan_name,
              (SELECT COUNT(*) FROM customers c WHERE c.shop_id = s.id) AS customer_count
         FROM shops s LEFT JOIN plans p ON p.id = s.plan_id
        WHERE ${whereClause} ORDER BY s.created_at DESC LIMIT :limit OFFSET :offset`,
      { replacements: { ...replacements, limit, offset }, type: db.sequelize.QueryTypes.SELECT }
    );

    return { rows: shops, count: Number(total), page: parseInt(page) || 1, limit };
  }

  async getShopById(shopId) {
    const shop = await db.Shop.findByPk(shopId, {
      include: [
        { model: db.Plan, as: 'plan' },
        { model: db.User, as: 'users', attributes: ['id', 'name', 'phone', 'role', 'is_active', 'created_at'] },
      ]
    });
    
    if (!shop) throw { statusCode: 404, message: 'Shop not found' };

    const customerCount = await db.Customer.count({ where: { shop_id: shopId } });
    const fullShop = shop.toJSON();
    fullShop.customer_count = customerCount;

    return fullShop;
  }

  async toggleShopStatus(shopId) {
    const shop = await db.Shop.findByPk(shopId);
    if (!shop) throw { statusCode: 404, message: 'Shop not found' };

    shop.is_active = !shop.is_active;
    if (!shop.is_active) {
      shop.subscription_status = 'locked';
    } else if (shop.subscription_status === 'locked') {
      shop.subscription_status = 'active';
    }

    await shop.save();
    return shop;
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

    if (data.logo !== undefined) {
       updateData.logo = data.logo; 
    }

    if (Object.keys(updateData).length === 0) return { message: 'Nothing to update' };

    await db.Shop.update(updateData, { where: { id: shopId } });
    return { message: 'Shop updated' };
  }

  async getPlans() {
    return await db.Plan.findAll({
      attributes: ['id', 'name', 'price_monthly', 'price_yearly', 'max_customers', 'trial_days', 'features', 'is_active'],
      order: [['id', 'ASC']]
    });
  }

  async createPlan(data) {
    return await db.Plan.create(data);
  }

  async updatePlan(planId, data) {
    const plan = await db.Plan.findByPk(planId);
    if (!plan) throw { statusCode: 404, message: 'Plan not found' };

    await plan.update(data);
    return plan;
  }

  async deletePlan(planId) {
    const plan = await db.Plan.findByPk(planId);
    if (!plan) throw { statusCode: 404, message: 'Plan not found' };

    // Prevent deleting if shops are assigned
    const shopCount = await db.Shop.count({ where: { plan_id: planId } });
    if (shopCount > 0) throw { statusCode: 409, message: 'Cannot delete plan because shops are currently subscribed to it.' };

    await plan.destroy();
    return { message: 'Plan deleted successfully' };
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
        plan_id: data.plan_id === 'null' ? null : (data.plan_id || null),
        logo: data.logo || null,
        is_active: data.is_active === 'false' ? false : (data.is_active !== undefined ? data.is_active : true)
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
