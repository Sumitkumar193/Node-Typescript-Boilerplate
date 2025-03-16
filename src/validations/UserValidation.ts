import joi from 'joi';

export const loginValidation = joi.object({
  email: joi.string().email().required(),
  password: joi.string().required(),
});

export const createUserValidation = joi.object({
  name: joi.string().required(),
  email: joi.string().email().required(),
  password: joi.string().required(),
  confirmPassword: joi.string().required().valid(joi.ref('password')),
});

export const forgotPasswordValidation = joi.object({
  email: joi.string().email().required(),
});

export const passwordResetValidation = joi.object({
  password: joi.string().required(),
  confirmPassword: joi.string().required().valid(joi.ref('password')),
});
