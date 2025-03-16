import joi from 'joi';

export const createProductValidation = joi.object({
  name: joi.string().required(),
  description: joi.string().required(),
  price: joi.number().required(),
  stock: joi.number().required(),
});

export const updateProductValidation = joi.object({
  name: joi.string(),
  description: joi.string(),
  price: joi.number(),
  stock: joi.number(),
});

export const updateProductStockValidation = joi.object({
  stock: joi.number().required(),
});
