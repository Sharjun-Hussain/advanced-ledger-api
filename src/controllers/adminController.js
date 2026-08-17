const adminService = require('../services/adminService');
const Joi = require('joi'); // Inline validation for admin patch

const updateShopValidation = Joi.object({
  isActive: Joi.boolean().optional(),
  subscriptionStatus: Joi.string().valid('trial', 'active', 'expired', 'locked').optional(),
  planId: Joi.number().integer().optional()
});

const createShopValidation = Joi.object({
  name: Joi.string().max(150).required(),
  phone: Joi.string().max(20).required(),
  address: Joi.string().max(255).optional().allow('', null),
  business_type: Joi.string().max(80).optional().allow('', null),
  language_pref: Joi.string().valid('sinhala', 'tamil', 'english').optional(),
  plan_id: Joi.number().integer().optional().allow(null),
  subscription_status: Joi.string().valid('trial', 'active', 'expired', 'locked').optional(),
  is_active: Joi.boolean().optional(),
  owner_name: Joi.string().max(100).optional().allow('', null),
  owner_nic: Joi.string().max(20).optional().allow('', null),
  password: Joi.string().min(6).optional().allow('', null)
});

class AdminController {
  async getStats(req, res, next) {
    try {
      const stats = await adminService.getStats();
      res.status(200).json({ stats });
    } catch (err) {
      next(err);
    }
  }

  async getShops(req, res, next) {
    try {
      const shops = await adminService.getShops(req.query);
      res.status(200).json({ shops });
    } catch (err) {
      next(err);
    }
  }

  async createShop(req, res, next) {
    try {
      const { error, value } = createShopValidation.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const shop = await adminService.createShop(value);
      res.status(201).json({ status: 'success', data: shop });
    } catch (err) {
      next(err);
    }
  }

  async updateShop(req, res, next) {
    try {
      const { error, value } = updateShopValidation.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const result = await adminService.updateShop(Number(req.params.id), value);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async deleteShop(req, res, next) {
    try {
      const result = await adminService.deleteShop(Number(req.params.id));
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  async getPlans(req, res, next) {
    try {
      const plans = await adminService.getPlans();
      res.status(200).json({ plans });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
