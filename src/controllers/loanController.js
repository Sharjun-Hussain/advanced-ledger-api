const loanService = require('../services/loanService');
const loanValidation = require('../validations/loan.validation');
const activityService = require('../services/activityService');

class LoanController {
  async getLoans(req, res, next) {
    try {
      const loans = await loanService.getLoans(req.user.shop_id, req.query);
      res.status(200).json({ loans });
    } catch (err) {
      next(err);
    }
  }

  async addLoan(req, res, next) {
    try {
      const { error, value } = loanValidation.addLoan.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      console.log(`[Loan Create] Request to add loan for shop: ${req.user.shop_id} customer: ${value.customer_id} amount: ${value.amount}`);
      const result = await loanService.addLoan(req.user.shop_id, req.user.id, value);
      console.log(`[Loan Create] Successfully created loan ID ${result.id} with new balance ${result.balance}`);
      
      await activityService.logAction(req, 'LOAN_ISSUED', 'Loan', result.id, { 
        amount: value.amount, 
        customer_id: value.customerId 
      });

      res.status(201).json({ loan: { id: result.id }, balance: result.balance });

      // Trigger SMS Alert in background
      this._triggerSmsAlert(req.user.shop_id, value.customerId, value.amount, result.balance, 'loan');
    } catch (err) {
      next(err);
    }
  }

  async _triggerSmsAlert(shop_id, customer_id, amount, balance, type) {
    try {
      console.log(`\n============================`);
      console.log(`[SMS DEBUG] _triggerSmsAlert Triggered`);
      console.log(`[SMS DEBUG] Arguments: shop=${shop_id} customer=${customer_id} amt=${amount} bal=${balance} type=${type}`);
      const { Setting, Customer, Shop } = require('../models');
      const textLkService = require('../services/textLkService');
      
      const setting = await Setting.findOne({
        where: { shop_id, category: 'textlk_crm' }
      });

      console.log(`[SMS DEBUG] textlk_crm setting found? ${!!setting}`);

      if (setting) {
        const config = typeof setting.settings_data === 'string' ? JSON.parse(setting.settings_data) : setting.settings_data;
        console.log(`[SMS DEBUG] config.enableOrderSms is: ${config.enableOrderSms}`);
        
        if (config.enableOrderSms) {
          const customer = await Customer.findByPk(customer_id);
          const shop = await Shop.findByPk(shop_id);
          const phone = customer?.phone?.replace(/\D/g, '');
          console.log(`[SMS DEBUG] Customer Found: ${!!customer}, Phone parsed: ${phone}, Shop: ${shop?.name}`);
          if (!phone) {
            console.log(`[SMS DEBUG] Aborting SMS due to missing phone`);
            return;
          }

          const template = type === 'loan' 
              ? (config.orderSmsTemplate || 'Hi {customer_name}, a loan of Rs.{amount} was added. Balance: Rs.{balance}. Thanks, {shop_name}')
              : (config.distributorSmsTemplate || 'Hi {customer_name}, payment of Rs.{amount} received. Balance: Rs.{balance}. Thanks, {shop_name}');
          
          console.log(`[SMS DEBUG] Template picked: ${template}`);

          const message = template
              .replace(/{customer_name}/g, customer.first_name || customer.name || '')
              .replace(/{amount}/g, parseFloat(amount).toFixed(2))
              .replace(/{balance}/g, parseFloat(balance).toFixed(2))
              .replace(/{shop_name}/g, shop ? shop.name : '');
              
          console.log(`[SMS DEBUG] Parsed Final Message: ${message}`);
          console.log(`[SMS DEBUG] Handing off to textLkService.sendSms...`);
          await textLkService.sendSms(shop_id, {
            recipient: phone,
            message: message
          });
          console.log(`[SMS DEBUG] textLkService.sendSms completely resolved without throwing.`);
        }
      }
    } catch (err) {
      console.error('[SMS ERROR] Failed to send transaction SMS (catch block!):', err.message);
      console.error(err.stack);
    }
  }

  async recordLoanPayment(req, res, next) {
    try {
      const { error, value } = loanValidation.makeLoanPayment.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const result = await loanService.recordLoanPayment(req.user.shop_id, Number(req.params.id), req.user.id, value.amount);
      
      await activityService.logAction(req, 'LOAN_PAYMENT_RECORDED', 'Loan', Number(req.params.id), { 
        amount: value.amount, 
        new_balance: result.balance 
      });

      res.status(200).json({ message: 'Payment recorded', balance: result.balance, paid: result.paid });

      // Trigger SMS Alert in background
      this._triggerSmsAlert(req.user.shop_id, result.customer_id, value.amount, result.balance, 'payment');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LoanController();
