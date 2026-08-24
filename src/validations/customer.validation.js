const Joi = require('joi');

const addCustomer = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().max(20).optional().allow(null, ''),
  type: Joi.string().valid('daily', 'weekly', 'monthly', 'custom').required(),
  kind: Joi.string().valid('customer', 'distributor').optional(),
  customCycleDays: Joi.number().integer().min(1).max(365).optional().allow(null),
  loanLimit: Joi.number().min(0).optional(),
  nic: Joi.string().max(20).optional().allow(null, ''),
  customerCode: Joi.string().max(20).optional().allow(null, ''),
});

const updateCustomer = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  phone: Joi.string().max(20).optional().allow(null, ''),
  type: Joi.string().valid('daily', 'weekly', 'monthly', 'custom').optional(),
  customCycleDays: Joi.number().integer().min(1).max(365).optional().allow(null),
  loanLimit: Joi.number().min(0).optional(),
  nic: Joi.string().max(20).optional().allow(null, ''),
  customerCode: Joi.string().max(20).optional().allow(null, ''),
});

const lockCustomer = Joi.object({
  locked: Joi.boolean().required(),
});

const makePayment = Joi.object({
  amount: Joi.number().min(0.01).required(),
  payment_method: Joi.string().optional().allow('', null),
  cheque_details: Joi.object({
    cheque_number: Joi.string().required(),
    cheque_date: Joi.string().pattern(/^\\d{4}-\\d{2}-\\d{2}$/).required().messages({
      'string.pattern.base': 'cheque_date must be in YYYY-MM-DD format'
    }),
    bank_name: Joi.string().required(),
    branch_name: Joi.string().optional().allow('', null),
  }).optional().allow(null),
});

module.exports = {
  addCustomer,
  updateCustomer,
  lockCustomer,
  makePayment,
};
