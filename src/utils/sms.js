const textLkService = require('../services/textLkService');

async function sendSms(shopId, { to, message }) {
  try {
    const result = await textLkService.sendSms(shopId, { recipient: to, message });
    if (!result) {
      console.warn(`[SMS::stub] to=${to} -> ${message} (Text.lk natively disabled/not configured for shopId ${shopId})`);
      return { delivered: false, stub: true };
    }
    return { delivered: true, stub: false, ...result };
  } catch (err) {
    console.error(`[SMS] Failed to send SMS via Text.lk: ${err.message}`);
    throw err;
  }
}

module.exports = { sendSms };
