const Joi = require('joi');

const sendReminder = Joi.object({
  customerId: Joi.number().integer().required(),
  message: Joi.string().max(500).optional().allow('', null),
});

module.exports = {
  sendReminder,
};
