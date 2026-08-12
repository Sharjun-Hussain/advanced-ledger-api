const db = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthService {
  async login(phone, password) {
    const user = await db.User.findOne({ where: { phone, is_active: true } });
    if (!user) {
      throw { statusCode: 401, message: 'Invalid phone or password' };
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw { statusCode: 401, message: 'Invalid phone or password' };
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, shop_id: user.shop_id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    return { user, token };
  }

  async register(data) {
    const existing = await db.User.findOne({ where: { phone: data.phone } });
    if (existing) {
      throw { statusCode: 409, message: 'Phone already registered' };
    }

    const transaction = await db.sequelize.transaction();
    try {
      const shop = await db.Shop.create({
        name: data.shopName,
        phone: data.phone,
        address: data.address,
        business_type: data.businessType,
        language_pref: data.languagePref || 'sinhala',
        subscription_status: 'trial'
      }, { transaction });

      const hash = await bcrypt.hash(data.password, 10);
      const user = await db.User.create({
        shop_id: shop.id,
        name: data.ownerName,
        phone: data.phone,
        password_hash: hash,
        role: 'owner',
      }, { transaction });

      await transaction.commit();

      const token = jwt.sign(
        { id: user.id, role: user.role, shop_id: shop.id },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
      );

      return { user, shop, token };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new AuthService();
