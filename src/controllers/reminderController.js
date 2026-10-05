const reminderService = require('../services/reminderService');
const reminderValidation = require('../validations/reminder.validation');

class ReminderController {
  async sendReminder(req, res, next) {
    try {
      const { error, value } = reminderValidation.sendReminder.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const smsResult = await reminderService.sendReminder(req.user.shop_id, value);
      if (smsResult.delivered) {
        return res.status(201).json({ message: 'Reminder sent', sms: smsResult });
      }
      // Logged as failed — tell the client honestly so it doesn't show success.
      return res.status(502).json({ message: 'Reminder logged but SMS delivery failed', sms: smsResult });
    } catch (err) {
      next(err);
    }
  }

  async getReminders(req, res, next) {
    try {
      const data = await reminderService.getReminders(req.user.shop_id, req.query);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async getPolicy(req, res, next) {
    try {
      const bundle = await reminderService.getPolicy(req.user.shop_id);
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  async savePolicy(req, res, next) {
    try {
      const policy = await reminderService.savePolicy(req.user.shop_id, req.body || {});
      res.status(200).json({ policy });
    } catch (err) {
      next(err);
    }
  }

  async getRules(req, res, next) {
    try {
      const rules = await reminderService.getRules(req.user.shop_id);
      res.status(200).json({ rules });
    } catch (err) {
      next(err);
    }
  }

  async saveRule(req, res, next) {
    try {
      const rule = await reminderService.saveRule(req.user.shop_id, req.body || {});
      res.status(201).json({ rule });
    } catch (err) {
      next(err);
    }
  }

  async deleteRule(req, res, next) {
    try {
      const result = await reminderService.deleteRule(req.user.shop_id, req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async sendBulk(req, res, next) {
    try {
      const summary = await reminderService.sendBulk(req.user.shop_id, req.body || {});
      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  }

  async runAutomation(req, res, next) {
    try {
      const summary = await reminderService.evaluateRules(req.user.shop_id, req.body || {});
      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReminderController();
