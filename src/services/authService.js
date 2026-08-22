const db = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const textLkService = require('./textLkService');

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
        subscription_status: data.is_auto_verified ? 'active' : 'trial'
      }, { transaction });

      const hash = await bcrypt.hash(data.password, 10);
      const user = await db.User.create({
        shop_id: shop.id,
        name: data.ownerName,
        phone: data.phone,
        nic: data.ownerNic,
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

  async forgotPassword(phone) {
    const user = await db.User.findOne({ where: { phone, is_active: true } });
    if (!user) {
      // Return success even if user not found to prevent user enumeration
      return { success: true };
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    await db.OtpLog.create({
      phone,
      otp_code: otpCode,
      purpose: 'forgot_password',
      expires_at: new Date(Date.now() + 15 * 60000) // 15 mins expiry
    });

    const message = `Your LedgerLK password reset code is ${otpCode}. It will expire in 15 minutes.`;
    
    // We pass null for shopId to use global platform config for password resets.
    await textLkService.sendSms(null, {
      recipient: phone,
      message,
      sender_id: 'LedgerLK' // fallback sender
    });

    return { success: true };
  }

  async resetPassword(phone, otpCode, newPassword) {
    const otpLog = await db.OtpLog.findOne({
      where: {
        phone,
        otp_code: otpCode,
        purpose: 'forgot_password',
        used: false
      }
    });

    if (!otpLog || otpLog.expires_at < new Date()) {
      throw { statusCode: 400, message: 'Invalid or expired OTP' };
    }

    const user = await db.User.findOne({ where: { phone, is_active: true } });
    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    const hash = await bcrypt.hash(newPassword, 10);
    
    const transaction = await db.sequelize.transaction();
    try {
      await user.update({ password_hash: hash }, { transaction });
      await otpLog.update({ used: true }, { transaction });
      await transaction.commit();
      return { success: true };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
  async changePassword(userId, oldPassword, newPassword) {
    const user = await db.User.findByPk(userId);
    if (!user) throw { statusCode: 404, message: 'User not found' };

    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) throw { statusCode: 401, message: 'Incorrect old password' };

    const hash = await bcrypt.hash(newPassword, 10);
    await user.update({ password_hash: hash });
    return { success: true };
  }
}
module.exports = new AuthService();
