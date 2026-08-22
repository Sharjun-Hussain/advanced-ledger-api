const db = require('../models');
const bcrypt = require('bcryptjs');

class ShopService {
  async getShopProfile(shopId) {
    const shop = await db.sequelize.query(
      `SELECT s.id, s.name, s.address, s.business_type, s.language_pref, s.phone,
              s.subscription_status, s.trial_ends_at, s.plan_ends_at,
              p.name AS plan_name, p.max_customers,
              (SELECT COUNT(*) FROM customers c WHERE c.shop_id = s.id AND c.is_active = 1) AS customer_count,
              (SELECT COUNT(*) FROM users u WHERE u.shop_id = s.id AND u.is_active = 1) AS staff_count
         FROM shops s
         LEFT JOIN plans p ON p.id = s.plan_id
        WHERE s.id = :shopId`,
      { replacements: { shopId }, type: db.sequelize.QueryTypes.SELECT }
    );
    if (!shop || shop.length === 0) throw { statusCode: 404, message: 'Shop not found' };
    return shop[0];
  }

  async updateShop(shopId, data, userId) {
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.businessType !== undefined) updateData.business_type = data.businessType;
    if (data.languagePref !== undefined) updateData.language_pref = data.languagePref;
    if (data.textlkEnabled !== undefined) updateData.textlk_enabled = data.textlkEnabled;

    if (Object.keys(updateData).length > 0) {
      await db.Shop.update(updateData, { where: { id: shopId } });
    }

    if (data.ownerName && userId) {
      await db.User.update(
        { name: data.ownerName },
        { where: { id: userId, shop_id: shopId } }
      );
    }

    return { message: 'Profile updated successfully' };
  }

  async getDashboard(shopId) {
    const outstanding = await db.Customer.sum('balance', { where: { shop_id: shopId, is_active: 1 } });
    
    const [collectionsRes] = await db.sequelize.query(
      `SELECT COALESCE(SUM(t.amount),0) AS today FROM transactions t 
       JOIN accounts a ON t.account_id = a.id
       WHERE t.shop_id = :shopId AND a.code IN ('1000', '1010') AND t.type = 'debit' AND DATE(t.transaction_date) = CURDATE()`,
      { replacements: { shopId }, type: db.sequelize.QueryTypes.SELECT }
    );

    const [overdueRes] = await db.sequelize.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(balance),0) AS amount FROM customers WHERE shop_id = :shopId AND is_active = 1 AND is_locked = 1`,
      { replacements: { shopId }, type: db.sequelize.QueryTypes.SELECT }
    );

    const activityService = require('./activityService');
    const recent = await activityService.getFeed(shopId, 10);

    return {
      outstanding: outstanding || 0,
      collections: collectionsRes.today,
      overdue: { count: overdueRes.count, amount: overdueRes.amount },
      recent
    };
  }

  async addStaff(shopId, data) {
    const existing = await db.User.findOne({ where: { phone: data.phone } });
    if (existing) throw { statusCode: 409, message: 'Phone already has an account' };

    const hash = await bcrypt.hash(data.password, 10);
    await db.User.create({
      shop_id: shopId,
      name: data.name,
      phone: data.phone,
      password_hash: hash,
      role: 'staff',
      permissions: data.permissions || ['loans:write']
    });
    return { message: 'Staff added' };
  }

  async getStaff(shopId) {
    return await db.sequelize.query(
      `SELECT id, name, phone, role, permissions, is_active, created_at FROM users WHERE shop_id = :shopId AND role != 'owner'`,
      { replacements: { shopId }, type: db.sequelize.QueryTypes.SELECT }
    );
  }

  async updateStaff(shopId, staffId, data) {
    const updateData = {};
    if (data.permissions !== undefined) updateData.permissions = data.permissions;
    if (data.isActive !== undefined) updateData.is_active = data.isActive ? 1 : 0;
    
    if (Object.keys(updateData).length === 0) return { message: 'Nothing to update' };

    await db.User.update(updateData, { where: { id: staffId, shop_id: shopId, role: 'staff' } });
    return { message: 'Staff updated' };
  }
}

module.exports = new ShopService();
