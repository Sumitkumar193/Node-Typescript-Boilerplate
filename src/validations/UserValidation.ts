import joi from 'joi';

// bcrypt silently truncates input beyond 72 bytes, so cap password length
// there to avoid two different long passwords hashing identically.
const password = joi.string().max(72, 'utf8');

export const loginValidation = joi.object({
  email: joi.string().email().required(),
  password: password.required(),
});

export const createUserValidation = joi.object({
  name: joi.string().required(),
  email: joi.string().email().required(),
  password: password.required(),
  confirmPassword: joi.string().required().valid(joi.ref('password')),
});

export const forgotPasswordValidation = joi.object({
  email: joi.string().email().required(),
});

export const passwordResetValidation = joi.object({
  password: password.required(),
  confirmPassword: joi.string().required().valid(joi.ref('password')),
});
