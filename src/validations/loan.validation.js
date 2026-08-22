const Joi = require('joi');

const addLoan = Joi.object({
  customerId: Joi.number().integer().required(),
  amount: Joi.number().min(0.01).required(),
  note: Joi.string().max(255).optional().allow('', null),
});

const makeLoanPayment = Joi.object({
  amount: Joi.number().min(0.01).required(),
  payment_method: Joi.string().optional().allow('', null),
});

module.exports = {
  addLoan,
  makeLoanPayment,
};
