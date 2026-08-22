const customerService = require('../services/customerService');
const customerValidation = require('../validations/customer.validation');
const activityService = require('../services/activityService');

class CustomerController {
  async getCustomers(req, res, next) {
    try {
      const customers = await customerService.getCustomers(req.user.shop_id, { ...req.query, kind: 'customer' });
      res.status(200).json({ customers });
    } catch (err) {
      next(err);
    }
  }

  async addCustomer(req, res, next) {
    try {
      const { error, value } = customerValidation.addCustomer.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      value.kind = 'customer';
      const customer = await customerService.addCustomer(req.user.shop_id, value);
      
      await activityService.logAction(req, 'CUSTOMER_CREATED', 'Customer', customer.id, { 
        name: customer.name, 
        customer_code: customer.customer_code 
      });

      res.status(201).json({ customer });
    } catch (err) {
      next(err);
    }
  }

  async getCustomer(req, res, next) {
    try {
      const customer = await customerService.getCustomer(req.user.shop_id, Number(req.params.id));
      res.status(200).json({ customer });
    } catch (err) {
      next(err);
    }
  }

  async updateCustomer(req, res, next) {
    try {
      const { error, value } = customerValidation.updateCustomer.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const result = await customerService.updateCustomer(req.user.shop_id, Number(req.params.id), value);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async lockCustomer(req, res, next) {
    try {
      const { error, value } = customerValidation.lockCustomer.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const result = await customerService.lockCustomer(req.user.shop_id, Number(req.params.id), value.locked);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async recordPayment(req, res, next) {
    try {
      const { error, value } = customerValidation.makePayment.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const result = await customerService.recordPayment(req.user.shop_id, Number(req.params.id), req.user.id, value.amount);
      res.status(200).json({ message: 'Payment recorded', balance: result.balance });

      // Trigger SMS Alert in background
      this._triggerSmsAlert(req.user.shop_id, Number(req.params.id), value.amount, result.balance);
    } catch (err) {
      next(err);
    }
  }

  async getCustomerHistory(req, res, next) {
    try {
      const history = await customerService.getCustomerHistory(req.user.shop_id, Number(req.params.id));
      res.status(200).json(history);
    } catch (err) {
      next(err);
    }
  }

  async _triggerSmsAlert(shop_id, customer_id, amount, balance) {
    try {
      const { Setting, Customer, Shop } = require('../models');
      const textLkService = require('../services/textLkService');
      
      const setting = await Setting.findOne({
        where: { shop_id, category: 'textlk_crm' }
      });

      if (setting) {
        const config = typeof setting.settings_data === 'string' ? JSON.parse(setting.settings_data) : setting.settings_data;
        
        if (config.enableOrderSms) {
          const customer = await Customer.findByPk(customer_id);
          const shop = await Shop.findByPk(shop_id);
          const phone = customer?.phone?.replace(/\D/g, '');
          if (!phone) return;

          const template = config.distributorSmsTemplate || '{shop_name}: Dear {customer_name}, payment of Rs.{amount} received. Balance: Rs.{balance}.';
          
          const message = template
              .replace(/{customer_name}/g, customer.first_name || customer.name || '')
              .replace(/{amount}/g, parseFloat(amount).toFixed(2))
              .replace(/{balance}/g, parseFloat(balance).toFixed(2))
              .replace(/{shop_name}/g, shop ? shop.name : '');
              
          await textLkService.sendSms(shop_id, {
            recipient: phone,
            message: message
          });
        }
      }
    } catch (err) {
      console.error('[SMS ERROR] Failed to send payment SMS:', err.message);
    }
  }
  async getCustomerLedger(req, res, next) {
    try {
      const accountingService = require('../services/accountingService');
      const { Account, Transaction } = require('../models');
      const { id } = req.params;
      const { from_date, to_date } = req.query;

      const customer = await customerService.getCustomer(req.user.shop_id, Number(id));

      let arAccount = await Account.findOne({
        where: { shop_id: req.user.shop_id, code: '1100' }
      });

      if (!arAccount) {
          // Auto-heal missing accounts for older shops created before accounting modules
          await accountingService.ensureDefaultAccounts(req.user.shop_id);
          arAccount = await Account.findOne({
              where: { shop_id: req.user.shop_id, code: '1100' }
          });
      }

      if (!arAccount) {
          return res.status(500).json({ status: 'error', message: 'Accounts Receivable account not found.' });
      }

      const where = {
          customer_id: id,
          account_id: arAccount.id
      };
      
      const { Op } = require('sequelize');
      if (from_date && to_date) {
          where.transaction_date = {
              [Op.between]: [new Date(from_date), new Date(to_date)]
          };
      }

      const transactions = await Transaction.findAll({
          where,
          include: [{ model: Account, as: 'account' }],
          order: [['transaction_date', 'ASC'], ['id', 'ASC']]
      });

      let balance = parseFloat(customer.balance || 0);
      const ledger = transactions.map(t => {
          if (t.type === 'debit') {
              balance += parseFloat(t.amount);
          } else {
              balance -= parseFloat(t.amount);
          }
          return {
              ...t.toJSON(),
              balance
          };
      });

      return res.status(200).json({ customer, ledger, current_balance: balance });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CustomerController();
