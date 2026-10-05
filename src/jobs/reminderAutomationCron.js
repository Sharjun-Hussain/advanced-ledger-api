const cron = require('node-cron');
const db = require('../models');
const logger = require('../utils/logger');

// Daily automation runner: evaluates each shop's reminder rules
// (balance_exceeds, loan_limit_exceeded, overdue_days, month_end).
// Runs 09:00 Asia/Colombo — inside quiet hours? Default quiet is
// 20:00–08:00, so 09:00 is safe. Per-shop policy still enforced
// per send (cooldown, caps, quiet hours).
const runAutomation = async () => {
  try {
    const shops = await db.Shop.findAll({
      where: { is_active: true },
      attributes: ['id'],
    });
    const reminderService = require('../services/reminderService');
    let totalSent = 0;
    for (const shop of shops) {
      try {
        const rules = await reminderService.getRules(shop.id);
        if (!rules.some((r) => r.enabled)) continue;
        const summary = await reminderService.evaluateRules(shop.id);
        totalSent += summary.sent || 0;
      } catch (err) {
        logger.error(`[reminderAutomation] shop ${shop.id}: ${err.message}`);
      }
    }
    logger.info(`[reminderAutomation] done, total sent: ${totalSent}`);
  } catch (err) {
    logger.error(`[reminderAutomation] failed: ${err.message}`);
  }
};

const initReminderAutomation = () => {
  // 09:00 daily Asia/Colombo
  cron.schedule('0 9 * * *', runAutomation, { timezone: 'Asia/Colombo' });
};

module.exports = { initReminderAutomation, runAutomation };
