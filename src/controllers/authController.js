const authService = require('../services/authService');
const authValidation = require('../validations/auth.validation');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const activityService = require('../services/activityService');

class AuthController {
  async login(req, res, next) {
    try {
      const { error, value } = authValidation.login.validate(req.body);
      if (error) {
        return errorResponse(res, error.details[0].message, 400);
      }

      const { phone, password } = value;
      const result = await authService.login(phone, password);
      
      // Log Activity explicitly since req.user isn't populated on unprotected routes
      await activityService.logSystemAction(
        result.user.shop_id, 
        result.user.id, 
        'LOGIN', 
        'User', 
        result.user.id, 
        { device: req.headers['user-agent'] }, 
        req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress
      );

      successResponse(res, result, 'Login successful');
    } catch (err) {
      next(err);
    }
  }

  async register(req, res, next) {
    try {
      const { error, value } = authValidation.register.validate(req.body);
      if (error) {
        return errorResponse(res, error.details[0].message, 400);
      }

      const result = await authService.register(value);
      successResponse(res, result, 'Registration successful');
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      successResponse(res, { user: req.user }, 'User profile fetched');
    } catch (err) {
      next(err);
    }
  }

  async loginAdmin(req, res, next) {
    try {
      const { error, value } = authValidation.adminLogin.validate(req.body);
      if (error) {
        return errorResponse(res, error.details[0].message, 400);
      }

      const { email, password } = value;
      const result = await authService.login(email, password);
      
      const mappedUser = {
          id: result.user.id,
          name: result.user.name,
          username: result.user.phone,
          email: result.user.phone, // Map phone to email for frontend compatibility
          user_type: result.user.role,
          can_login: result.user.is_active,
          profile_image: null,
          roles: [{ name: result.user.role }] 
      };

      successResponse(res, {
        user: mappedUser,
        auth_token: result.token
      }, 'Login successful');
    } catch (err) {
      if (err.statusCode === 401) {
        return errorResponse(res, err.message, 401);
      }
      next(err);
    }
  }

  async getUserProfile(req, res, next) {
    try {
      const mappedUser = {
          id: req.user.id,
          name: req.user.name,
          username: req.user.phone,
          email: req.user.phone,
          user_type: req.user.role,
          can_login: req.user.is_active,
          profile_image: null,
          roles: req.user.role ? [{ name: req.user.role }] : []
      };

      successResponse(res, { user: mappedUser }, 'User profile fetched');
    } catch (err) {
      next(err);
    }
  }
}


module.exports = new AuthController();
