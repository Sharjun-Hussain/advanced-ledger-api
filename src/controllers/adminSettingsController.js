const { Setting } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

class AdminSettingsController {
  
  /**
   * Fetch all global settings (shop_id = null)
   */
  async getSettings(req, res, next) {
    try {
      const settings = await Setting.findAll({
        where: { shop_id: null }
      });

      // Flatten settings into a key-value pair object
      const data = {};
      settings.forEach(s => {
        // Assume category is used as the high level struct if needed, but typically setting_data holds the pairs
        if (s.settings_data) {
           Object.assign(data, s.settings_data);
        }
      });

      successResponse(res, data, 'Global settings fetched successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Save global settings (shop_id = null)
   * The formData comes in as req.body keys and values.
   */
  async saveSettings(req, res, next) {
    try {
      const { body } = req;
      
      // We will store all global config under one 'global' category, 
      // or map them intelligently. For simplicity, we merge everything into a 'global' category row.
      let settingRow = await Setting.findOne({
        where: { shop_id: null, category: 'global' }
      });

      if (!settingRow) {
        settingRow = await Setting.create({
          shop_id: null,
          category: 'global',
          settings_data: {}
        });
      }

      // Merge new fields
      const updatedData = { ...settingRow.settings_data, ...body };

      // Handle file uploads (e.g., logos)
      if (req.file) {
        updatedData.site_logo = `/uploads/${req.file.filename}`;
      } else if (req.files) {
        if (req.files.logo && req.files.logo[0]) {
          updatedData.site_logo = `/uploads/${req.files.logo[0].filename}`;
        }
        if (req.files.favicon && req.files.favicon[0]) {
          updatedData.site_favicon = `/uploads/${req.files.favicon[0].filename}`;
        }
      }

      settingRow.settings_data = updatedData;
      await settingRow.save();

      successResponse(res, settingRow.settings_data, 'Global settings saved successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminSettingsController();
