const db = require('../models');
const { sendSms } = require('../utils/sms');

class ReminderService {
  async sendReminder(shopId, data) {
    const customer = await db.Customer.findOne({ where: { id: data.customerId, shop_id: shopId } });
    if (!customer) throw { statusCode: 404, message: 'Customer not found' };
    if (!customer.phone) throw { statusCode: 400, message: 'Customer has no phone number for SMS' };

    const text = data.message?.trim() || 
      `LedgerLK: Dear ${customer.name}, your outstanding balance is Rs. ${Number(customer.balance).toFixed(2)}. Please settle your payment. Thank you.`;

    let delivered = false;
    let stub = false;
    try {
      const result = await sendSms(shopId, { to: customer.phone, message: text });
      delivered = result.delivered;
      stub = result.stub;
    } catch (err) {
      console.warn('SMS failed:', err.message);
    }

    await db.Reminder.create({
      shop_id: shopId,
      customer_id: data.customerId,
      type: 'sms',
      message: text,
      scheduled_at: new Date(),
      sent_at: new Date(),
      status: delivered ? 'sent' : 'failed'
    });

    return { delivered, stub };
  }

  async getReminders(shopId, limitParam) {
    const limit = Math.min(Number(limitParam) || 50, 200);
    const reminders = await db.sequelize.query(
      `SELECT r.id, r.type, r.message, r.status, r.sent_at, c.name AS customer_name 
         FROM reminders r LEFT JOIN customers c ON c.id = r.customer_id 
        WHERE r.shop_id = :shopId ORDER BY r.sent_at DESC LIMIT :limit`,
      { replacements: { shopId, limit }, type: db.sequelize.QueryTypes.SELECT }
    );
    return reminders;
  }
}

module.exports = new ReminderService();
