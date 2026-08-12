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
}

module.exports = new AuthController();
