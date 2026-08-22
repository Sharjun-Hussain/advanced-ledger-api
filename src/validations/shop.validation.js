const Joi = require('joi');

const updateShop = Joi.object({
  name: Joi.string().min(2).max(150).optional(),
  address: Joi.string().max(255).optional(),
  businessType: Joi.string().max(80).optional(),
  languagePref: Joi.string().valid('sinhala', 'tamil', 'english').optional(),
  ownerName: Joi.string().min(2).max(100).optional(),
  textlkEnabled: Joi.boolean().optional(),
});

const addStaff = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().min(9).max(20).required(),
  password: Joi.string().min(6).required(),
  permissions: Joi.array().items(Joi.string()).optional(),
});

const updateStaff = Joi.object({
  permissions: Joi.array().items(Joi.string()).optional(),
  isActive: Joi.boolean().optional(),
});

module.exports = {
  updateShop,
  addStaff,
  updateStaff,
};
