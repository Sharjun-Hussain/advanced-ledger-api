const { Setting } = require('../models');
const { successResponse } = require('../utils/responseHandler');

class PublicController {
  async getConfig(req, res, next) {
    try {
      // Fetch global setting
      const globalSetting = await Setting.findOne({ where: { shop_id: null, category: 'global' } });
      const config = globalSetting?.settings_data || {};

      // Standardize the response data that any mobile/web client can access without auth.
      // Do not expose sensitive info here.
      const data = {
        mobile_app_version: config.mobile_app_version || '1.0.0',
        force_update: config.force_update === 'true' || config.force_update === true,
        android_store_url: config.android_store_url || 'https://play.google.com/store',
        ios_store_url: config.ios_store_url || 'https://apps.apple.com/'
      };

      successResponse(res, data, 'Public config fetched successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PublicController();
