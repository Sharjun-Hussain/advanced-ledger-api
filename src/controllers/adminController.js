const adminService = require('../services/adminService');
const Joi = require('joi'); // Inline validation for admin patch

const updateShopValidation = Joi.object({
  isActive: Joi.boolean().optional(),
  subscriptionStatus: Joi.string().valid('trial', 'active', 'expired', 'locked').optional(),
  planId: Joi.number().integer().optional()
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
