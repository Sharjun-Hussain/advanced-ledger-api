const reminderService = require('../services/reminderService');
const reminderValidation = require('../validations/reminder.validation');

class ReminderController {
  async sendReminder(req, res, next) {
    try {
      const { error, value } = reminderValidation.sendReminder.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const smsResult = await reminderService.sendReminder(req.user.shop_id, value);
      res.status(200).json({ message: 'Reminder sent', sms: smsResult });
    } catch (err) {
      next(err);
    }
  }

  async getReminders(req, res, next) {
    try {
      const reminders = await reminderService.getReminders(req.user.shop_id, req.query.limit);
      res.status(200).json({ reminders });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReminderController();
