const customerService = require('../services/customerService');
const customerValidation = require('../validations/customer.validation');

class DistributorController {
  async getDistributors(req, res, next) {
    try {
      const distributors = await customerService.getCustomers(req.user.shop_id, { ...req.query, kind: 'distributor' });
      res.status(200).json({ distributors });
    } catch (err) {
      next(err);
    }
  }

  async addDistributor(req, res, next) {
    try {
      const { error, value } = customerValidation.addCustomer.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      value.kind = 'distributor';
      const distributor = await customerService.addCustomer(req.user.shop_id, value);
      res.status(201).json({ distributor });
    } catch (err) {
      next(err);
    }
  }

  async getDistributor(req, res, next) {
    try {
      const distributor = await customerService.getCustomer(req.user.shop_id, Number(req.params.id));
      res.status(200).json({ distributor });
    } catch (err) {
      next(err);
    }
  }

  async updateDistributor(req, res, next) {
    try {
      const { error, value } = customerValidation.updateCustomer.validate(req.body);
      if (error) return res.status(400).json({ status: 'error', message: error.details[0].message });

      const result = await customerService.updateCustomer(req.user.shop_id, Number(req.params.id), value);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async lockDistributor(req, res, next) {
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

  async getDistributorHistory(req, res, next) {
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
      console.error('[SMS ERROR] Failed to send remote payment SMS:', err.message);
    }
  }
}

module.exports = new DistributorController();
