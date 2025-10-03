import joi from 'joi';
import { InviteType, OrganizationType } from '@prisma/client';

export const loginValidation = joi.object({
  email: joi.string().email().required(),
  password: joi.string().required(),
});

export const createUserValidation = joi.object({
  name: joi.string().required(),
  email: joi.string().email().required(),
  password: joi.string().required(),
  confirmPassword: joi.string().required().valid(joi.ref('password')),
  token: joi.string().optional(),
  organization: joi
    .object({
      name: joi.string().required(),
      address: joi.string().required(),
      placeId: joi.string().required(),
      latitude: joi.number().required(),
      longitude: joi.number().required(),
      type: joi
        .string()
        .valid(...Object.values(OrganizationType))
        .optional(),
    })
    .optional(),
});

export const createInviteValidation = joi.object({
  email: joi.string().email().required(),
  type: joi
    .string()
    .valid(...Object.values(InviteType))
    .required(),
});

export const forgotPasswordValidation = joi.object({
  email: joi.string().email().required(),
});

export const passwordResetValidation = joi.object({
  password: joi.string().required(),
  confirmPassword: joi.string().required().valid(joi.ref('password')),
});
