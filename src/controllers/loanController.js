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

      const result = await loanService.addLoan(req.user.shop_id, req.user.id, value);
      
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

  async updateLoan(req, res, next) {
    try {
      const { id } = req.params;
      const { error, value } = loanValidation.updateLoan.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const result = await loanService.updateLoan(req.user.shop_id, id, req.user.id, value);
      
      await activityService.logAction(req, 'LOAN_EDITED', 'Loan', id, { 
        amount: value.amount, 
        note: value.note 
      });

      res.status(200).json({ status: 'success', balance: result.balance });
    } catch (err) {
      next(err);
    }
  }

  async deleteLoan(req, res, next) {
    try {
      const { id } = req.params;
      const result = await loanService.deleteLoan(req.user.shop_id, id, req.user.id);
      
      await activityService.logAction(req, 'LOAN_DELETED', 'Loan', id, { 
        amount_removed: result.amount_removed 
      });

      res.status(200).json({ status: 'success', balance: result.balance });
    } catch (err) {
      next(err);
    }
  }

  async _triggerSmsAlert(shop_id, customer_id, amount, balance, type) {
    try {
      const { Setting, Customer, Shop } = require('../models');
      const textLkService = require('../services/textLkService');
      
      const setting = await Setting.findOne({
        where: { shop_id, category: 'textlk_crm' }
      });

      if (!setting) {
        console.warn(`[SMS SKIP] shop=${shop_id}: no textlk_crm settings row`);
        return;
      }
      {
        const config = typeof setting.settings_data === 'string' ? JSON.parse(setting.settings_data) : setting.settings_data;

        // Loans and payments have independent toggles (payments fall back
        // to the loan flag for shops configured before the split).
        const wanted = type === 'loan'
          ? config.enableOrderSms
          : (config.enablePaymentSms ?? config.enableOrderSms);
        if (!wanted) {
          console.warn(`[SMS SKIP] shop=${shop_id} customer=${customer_id} type=${type}: template disabled`);
          return;
        }
        {
          const customer = await Customer.findByPk(customer_id);
          const shop = await Shop.findByPk(shop_id);
          const phone = customer?.phone?.replace(/\D/g, '');
          if (!phone) {
            console.warn(`[SMS SKIP] shop=${shop_id} customer=${customer_id}: no phone number`);
            return;
          }

          const template = type === 'loan' 
              ? (config.orderSmsTemplate || '{shop_name}: Dear {customer_name}, a loan of Rs.{amount} was added. Balance: Rs.{balance}.')
              : (config.distributorSmsTemplate || config.paymentSmsTemplate || '{shop_name}: Dear {customer_name}, payment of Rs.{amount} received. Balance: Rs.{balance}.');
          
          const message = template
              .replace(/{customer_name}/g, customer.name || '')
              .replace(/{amount}/g, parseFloat(amount).toFixed(2))
              .replace(/{balance}/g, parseFloat(balance).toFixed(2))
              .replace(/{shop_name}/g, shop ? shop.name : '');
              
          const sent = await textLkService.sendSms(shop_id, {
            recipient: phone,
            message: message
          });
          if (!sent) {
            console.warn(`[SMS SKIP] shop=${shop_id} customer=${customer_id}: gateway disabled/unconfigured`);
          }
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
