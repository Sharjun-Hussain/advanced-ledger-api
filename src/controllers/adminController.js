const adminService = require('../services/adminService');
const Joi = require('joi'); // Inline validation for admin patch
const { successResponse, paginatedResponse } = require('../utils/responseHandler');

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
  plan_id: Joi.alternatives().try(Joi.number().integer(), Joi.string().allow('', 'null')).optional(),
  subscription_status: Joi.string().valid('trial', 'active', 'expired', 'locked').optional(),
  is_active: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
  owner_name: Joi.string().max(100).optional().allow('', null),
  owner_nic: Joi.string().max(20).optional().allow('', null),
  password: Joi.string().min(6).optional().allow('', null)
});

class AdminController {
  async getStats(req, res, next) {
    try {
      const stats = await adminService.getStats();
      successResponse(res, stats, 'Admin stats fetched');
    } catch (err) {
      next(err);
    }
  }

  async getShops(req, res, next) {
    try {
      const { rows, count, page, limit } = await adminService.getShops(req.query);
      paginatedResponse(res, rows, { total: count, page, limit }, 'Shops fetched successfully');
    } catch (err) {
      next(err);
    }
  }

  async createShop(req, res, next) {
    try {
      const { error, value } = createShopValidation.validate(req.body);
      if (error) return errorResponse(res, error.details[0].message, 400);

      // Handle Logo Upload via multer
      if (req.file) {
          value.logo = req.file.path.replace(/\\/g, '/');
      }

      const shop = await adminService.createShop(value);
      successResponse(res, shop, 'Shop created successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateShop(req, res, next) {
    try {
      const updateData = { ...req.body };
      
      // Handle Logo Upload via multer
      if (req.file) {
          updateData.logo = req.file.path.replace(/\\/g, '/');
      }

      const result = await adminService.updateShop(Number(req.params.id), updateData);
      successResponse(res, result, 'Shop updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deleteShop(req, res, next) {
    try {
      const result = await adminService.deleteShop(Number(req.params.id));
      successResponse(res, result, 'Shop deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  async getPlans(req, res, next) {
    try {
      const plans = await adminService.getPlans();
      successResponse(res, plans, 'Plans fetched successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
