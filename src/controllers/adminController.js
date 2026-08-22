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

const createPlanValidation = Joi.object({
  name: Joi.string().max(50).required(),
  price_monthly: Joi.number().min(0).required(),
  price_yearly: Joi.number().min(0).required(),
  max_customers: Joi.number().integer().allow(null).optional(),
  trial_days: Joi.number().integer().min(0).required(),
  features: Joi.alternatives().try(Joi.object(), Joi.array()).optional(),
  is_active: Joi.boolean().optional()
});

const updatePlanValidation = Joi.object({
  name: Joi.string().max(50).optional(),
  price_monthly: Joi.number().min(0).optional(),
  price_yearly: Joi.number().min(0).optional(),
  max_customers: Joi.number().integer().allow(null).optional(),
  trial_days: Joi.number().integer().min(0).optional(),
  features: Joi.alternatives().try(Joi.object(), Joi.array()).optional(),
  is_active: Joi.boolean().optional()
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

  async getShopById(req, res, next) {
    try {
      const shop = await adminService.getShopById(Number(req.params.id));
      successResponse(res, shop, 'Shop details fetched successfully');
    } catch (err) {
      next(err);
    }
  }

  async toggleShopStatus(req, res, next) {
    try {
      const shop = await adminService.toggleShopStatus(Number(req.params.id));
      successResponse(res, shop, `Shop ${shop.is_active ? 'activated' : 'suspended'} successfully`);
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

  async createPlan(req, res, next) {
    try {
      const { error, value } = createPlanValidation.validate(req.body);
      if (error) return errorResponse(res, error.details[0].message, 400);

      const plan = await adminService.createPlan(value);
      successResponse(res, plan, 'Plan created successfully');
    } catch (err) {
      next(err);
    }
  }

  async updatePlan(req, res, next) {
    try {
      const { error, value } = updatePlanValidation.validate(req.body);
      if (error) return errorResponse(res, error.details[0].message, 400);

      const plan = await adminService.updatePlan(Number(req.params.id), value);
      successResponse(res, plan, 'Plan updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deletePlan(req, res, next) {
    try {
      const result = await adminService.deletePlan(Number(req.params.id));
      successResponse(res, result, 'Plan deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  async getActivityLogs(req, res, next) {
    try {
      const activityService = require('../services/activityService');
      const data = await activityService.getAdminFeed(req.query);
      successResponse(res, data, 'Activity logs fetched successfully');
    } catch (err) {
      next(err);
    }
  }

  async getActivityLogById(req, res, next) {
    try {
      const { id } = req.params;
      const db = require('../models');
      
      const query = `
        SELECT a.id, a.action_type as action, a.entity_type as module, a.created_at, a.ip_address, a.metadata as payload, 
               u.name as user_name, u.phone as user_phone
           FROM activity_logs a
           LEFT JOIN users u ON a.user_id = u.id
          WHERE a.id = :id
      `;
      const [log] = await db.sequelize.query(query, {
        replacements: { id }, type: db.sequelize.QueryTypes.SELECT
      });

      if (!log) return errorResponse(res, 'Log not found', 404);

      const data = {
          id: log.id,
          action: log.action,
          module: log.module,
          created_at: log.created_at,
          description: typeof log.payload === 'string' 
               ? (JSON.parse(log.payload)?.description || 'System log') 
               : (log.payload?.description || 'System Action Captured'),
          ip_address: log.ip_address,
          payload: typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload,
          user: { name: log.user_name || 'System', phone: log.user_phone }
      };

      successResponse(res, data, 'Activity log fetched successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
