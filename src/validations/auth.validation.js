const Joi = require('joi');

const login = Joi.object({
  phone: Joi.string().required(),
  password: Joi.string().required(),
});

const register = Joi.object({
  shopName: Joi.string().min(2).max(150).required(),
  ownerName: Joi.string().min(2).max(100).required(),
  phone: Joi.string().min(9).max(20).required(),
  password: Joi.string().min(6).required(),
  address: Joi.string().max(255).optional().allow('', null),
  businessType: Joi.string().max(80).optional().allow('', null),
  languagePref: Joi.string().valid('sinhala', 'tamil', 'english').default('sinhala')
});

module.exports = {
  login,
  register,
};
