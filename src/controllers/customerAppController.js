const customerAppService = require('../services/customerAppService');

class CustomerAppController {
  async getProfile(req, res, next) {
    try {
      if (req.user.role !== 'customer') {
        return res.status(403).json({ error: 'Customer account required' });
      }
      const customer = await customerAppService.getMyProfile(req.user.id);
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.status(200).json({ customer });
    } catch (err) {
      next(err);
    }
  }

  async getTransactions(req, res, next) {
    try {
      const transactions = await customerAppService.getMyTransactions(req.user.id);
      res.status(200).json({ transactions });
    } catch (err) {
      next(err);
    }
  }

  async getLoans(req, res, next) {
    try {
      const loans = await customerAppService.getMyLoans(req.user.id);
      res.status(200).json({ loans });
    } catch (err) {
      next(err);
    }
  }

  async getSchedule(req, res, next) {
    try {
      const schedule = await customerAppService.getMySchedule(req.user.id);
      if (!schedule) return res.status(404).json({ error: 'Customer not found' });
      res.status(200).json({ schedule });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CustomerAppController();
