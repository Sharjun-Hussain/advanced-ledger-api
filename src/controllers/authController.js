const authService = require('../services/authService');
const authValidation = require('../validations/auth.validation');

class AuthController {
  async login(req, res, next) {
    try {
      const { error, value } = authValidation.login.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.details[0].message });
      }

      const { phone, password } = value;
      const result = await authService.login(phone, password);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async register(req, res, next) {
    try {
      const { error, value } = authValidation.register.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.details[0].message });
      }

      const result = await authService.register(value);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getMe(req, res, next) {
    try {
      res.status(200).json({ user: req.user });
    } catch (err) {
      next(err);
    }
  }

  async loginAdmin(req, res, next) {
    try {
      const { error, value } = authValidation.adminLogin.validate(req.body);
      if (error) {
        return res.status(400).json({ status: 'error', message: error.details[0].message });
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

      res.status(200).json({
        status: "success",
        data: {
          user: mappedUser,
          auth_token: result.token
        }
      });
    } catch (err) {
      if (err.statusCode === 401) {
        return res.status(401).json({ status: 'error', message: err.message });
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

      res.status(200).json({
        status: "success",
        success: true,
        data: {
          user: mappedUser
        }
      });
    } catch (err) {
      next(err);
    }
  }
}


module.exports = new AuthController();
