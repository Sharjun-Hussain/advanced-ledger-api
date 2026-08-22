const shopService = require('../services/shopService');
const shopValidation = require('../validations/shop.validation');

class ShopController {
  async getProfile(req, res, next) {
    try {
      const shop = await shopService.getShopProfile(req.user.shop_id);
      res.status(200).json({ shop });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { error, value } = shopValidation.updateShop.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      if (req.file) {
        value.logo = req.file.filename;
      }

      const result = await shopService.updateShop(req.user.shop_id, value, req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getDashboard(req, res, next) {
    try {
      const dashboard = await shopService.getDashboard(req.user.shop_id);
      res.status(200).json({ dashboard });
    } catch (err) {
      next(err);
    }
  }

  async addStaff(req, res, next) {
    try {
      const { error, value } = shopValidation.addStaff.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const result = await shopService.addStaff(req.user.shop_id, value);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getStaff(req, res, next) {
    try {
      const staff = await shopService.getStaff(req.user.shop_id);
      res.status(200).json({ staff });
    } catch (err) {
      next(err);
    }
  }

  async updateStaff(req, res, next) {
    try {
      const { error, value } = shopValidation.updateStaff.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const result = await shopService.updateStaff(req.user.shop_id, Number(req.params.id), value);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ShopController();
