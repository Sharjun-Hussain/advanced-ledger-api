const loanService = require('../services/loanService');
const loanValidation = require('../validations/loan.validation');

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

      const result = await loanService.addLoan(req.user.shop_id, req.user.id, value);
      res.status(201).json({ loan: { id: result.id }, balance: result.balance });

      // Trigger SMS Alert in background
      this._triggerSmsAlert(req.user.shop_id, value.customer_id, value.amount, result.balance, 'loan');
    } catch (err) {
      next(err);
    }
  }

  async _triggerSmsAlert(shop_id, customer_id, amount, balance, type) {
    try {
      const { Setting, Customer } = require('../models');
      const textLkService = require('../services/textLkService');
      
      const setting = await Setting.findOne({
        where: { shop_id, category: 'textlk_crm' }
      });

      if (setting) {
        const config = typeof setting.settings_data === 'string' ? JSON.parse(setting.settings_data) : setting.settings_data;
        
        if (config.enableOrderSms) {
          const customer = await Customer.findByPk(customer_id);
          const phone = customer?.phone?.replace(/\D/g, '');
          if (!phone) return;

          const template = type === 'loan' 
              ? (config.orderSmsTemplate || 'Hi {customer_name}, a loan of Rs.{amount} was added. Balance: Rs.{balance}')
              : (config.distributorSmsTemplate || 'Hi {customer_name}, payment of Rs.{amount} received. Balance: Rs.{balance}');
          
          const message = template
              .replace(/{customer_name}/g, customer.first_name || customer.name || '')
              .replace(/{amount}/g, parseFloat(amount).toFixed(2))
              .replace(/{balance}/g, parseFloat(balance).toFixed(2));
              
          await textLkService.sendSms(shop_id, {
            recipient: phone,
            message: message
          });
        }
      }
    } catch (err) {
      console.error('[SMS ERROR] Failed to send transaction SMS:', err.message);
    }
  }

  async recordLoanPayment(req, res, next) {
    try {
      const { error, value } = loanValidation.makeLoanPayment.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const result = await loanService.recordLoanPayment(req.user.shop_id, Number(req.params.id), req.user.id, value.amount);
      res.status(200).json({ message: 'Payment recorded', balance: result.balance, paid: result.paid });

      // Trigger SMS Alert in background
      this._triggerSmsAlert(req.user.shop_id, result.customer_id, value.amount, result.balance, 'payment');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LoanController();
