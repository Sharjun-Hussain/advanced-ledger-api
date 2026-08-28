const cron = require("node-cron");
const db = require("../models");
const { Op } = require("sequelize");
const textLkService = require("../services/textLkService");

// Global Platform Setting Fallbacks
const DEFAULT_WARNING_SMS =
  "Your LedgerLK subscription is ending in {days} days. Please renew to keep your account active.";
const DEFAULT_EXPIRED_SMS =
  "Your LedgerLK subscription has expired. Your shop is now locked. Please contact support to renew.";

// Calculate days between two dates
const daysBetween = (futureDateStr) => {
  if (!futureDateStr) return null;
  const now = new Date();
  const future = new Date(futureDateStr);
  const diffTime = future - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const runSubscriptionCron = async () => {
  console.log("[CRON] Running daily subscription expiry check...");
  try {
    // 1. Fetch Global Custom Admin Settings
    const globalSetting = await db.Setting.findOne({ where: { shop_id: null, category: 'global' } });
    const config = globalSetting?.settings_data || {};

    let warningSmsTemplate = config.expiry_warning_sms_template || DEFAULT_WARNING_SMS;
    let expiredSmsTemplate = config.expired_lock_sms_template || DEFAULT_EXPIRED_SMS;

    // We fetch any shops that are active or in trial
    const shops = await db.Shop.findAll({
      where: {
        subscription_status: { [Op.in]: ["trial", "active"] },
        is_active: true,
      },
    });

    for (const shop of shops) {
      // Determine the active end date context
      let endDate =
        shop.subscription_status === "trial"
          ? shop.trial_ends_at
          : shop.plan_ends_at;
      let daysRemaining = daysBetween(endDate);

      // If limits aren't set, skip
      if (daysRemaining === null) continue;

      if (daysRemaining <= 0) {
        // EXPIRED
        console.log(`[CRON] Shop ${shop.id} (${shop.name}) expired!`);

        // 1. Lock the shop
        await shop.update({ subscription_status: "expired" });

        // 2. Send SMS to the shop owner using platform account
        const message = expiredSmsTemplate.replace("{shop_name}", shop.name);
        await textLkService
          .sendSms(null, {
            recipient: shop.phone,
            message: message,
            sender_id: "LedgerLK",
          })
          .catch((err) =>
            console.error(`[CRON] SMS failed for ID ${shop.id}:`, err.message),
          );
      } else if (
        daysRemaining === 7 ||
        daysRemaining === 3 ||
        daysRemaining === 1
      ) {
        // WARNING: 7 days, 3 days, or 1 day left
        console.log(
          `[CRON] Shop ${shop.id} (${shop.name}) expires in ${daysRemaining} days.`,
        );

        const message = warningSmsTemplate.replace(
          "{days}",
          daysRemaining.toString(),
        ).replace("{shop_name}", shop.name);

        await textLkService
          .sendSms(null, {
            recipient: shop.phone,
            message: message,
            sender_id: "LedgerLK",
          })
          .catch((err) =>
            console.error(
              `[CRON] Warning SMS failed for ID ${shop.id}:`,
              err.message,
            ),
          );
      }
    }
  } catch (error) {
    console.error("[CRON] Subscription check failed:", error);
  }
};

const initScheduledJobs = () => {
  // Run every day at 08:00 AM server time
  // '0 8 * * *'
  cron.schedule("0 8 * * *", runSubscriptionCron, {
    scheduled: true,
    timezone: "Asia/Colombo",
  });
  console.log(
    "[CRON] Subscription expiry watcher scheduled for 08:00 AM daily (Asia/Colombo).",
  );
};

module.exports = {
  initScheduledJobs,
  runSubscriptionCron, // Exported for manual trigger testing if needed
};
