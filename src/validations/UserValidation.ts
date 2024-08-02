import joi from 'joi';

export const createUserValidation = joi.object({
  email: joi.string().email().required(),
  password: joi.string().required(),
});