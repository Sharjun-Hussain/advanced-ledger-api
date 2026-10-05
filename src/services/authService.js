const db = require('../models');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const textLkService = require('./textLkService');

function getJwtSecrets() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('FATAL: JWT_SECRET env var is required');
  return { secret, expiresIn: process.env.JWT_EXPIRES_IN || '1h' };
}

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
      getJwtSecrets().secret,
      { expiresIn: getJwtSecrets().expiresIn }
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
      const now = new Date();
      const trialEndsAt = new Date(now);
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);
      const shop = await db.Shop.create({
        name: data.shopName,
        phone: data.phone,
        address: data.address,
        business_type: data.businessType,
        language_pref: data.languagePref || 'sinhala',
        // NOTE: client flag is_auto_verified is intentionally ignored —
        // new shops always start as trial; admin activates after payment.
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt
      }, { transaction });

      const hash = await bcrypt.hash(data.password, 10);
      // NIC is optional at signup (app doesn't collect it) — store NULL,
      // not '', so the UNIQUE constraint doesn't clash on repeat empties.
      const nic = data.ownerNic && String(data.ownerNic).trim() !== ''
        ? String(data.ownerNic).trim()
        : null;
      const user = await db.User.create({
        shop_id: shop.id,
        name: data.ownerName,
        phone: data.phone,
        nic,
        password_hash: hash,
        role: 'owner',
      }, { transaction });

      await transaction.commit();

      const token = jwt.sign(
        { id: user.id, role: user.role, shop_id: shop.id },
        getJwtSecrets().secret,
        { expiresIn: getJwtSecrets().expiresIn }
      );

      return { user, shop, token };
    } catch (error) {
      await transaction.rollback();
      if (error?.name === 'SequelizeUniqueConstraintError') {
        throw { statusCode: 409, message: 'Phone already registered' };
      }
      throw error;
    }
  }

  async forgotPassword(phone) {
    const user = await db.User.findOne({ where: { phone, is_active: true } });
    if (!user) {
      // Return success even if user not found to prevent user enumeration
      return { success: true };
    }

    // Invalidate any prior unused OTPs for this phone/purpose (single active OTP).
    await db.OtpLog.update(
      { used: true },
      { where: { phone, purpose: 'forgot_password', used: false } }
    );

    const otpCode = crypto.randomInt(100000, 1000000).toString();
    
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
    // Only the latest unused OTP for this phone is valid.
    const otpLog = await db.OtpLog.findOne({
      where: {
        phone,
        otp_code: otpCode,
        purpose: 'forgot_password',
        used: false
      },
      order: [['created_at', 'DESC']]
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
