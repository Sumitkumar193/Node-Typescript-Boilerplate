import Joi from 'joi';
import { JoiValidationErrors } from '@interfaces/AppCommonInterface';

export default function validate<T>(
  schema: Joi.ObjectSchema,
  data: T,
): JoiValidationErrors {
  const { error } = schema.validate(data, { abortEarly: false });
  const errors =
    error?.details.reduce(
      (acc, err) => {
        const key = err.context?.key as string;
        acc[key] = err.message;
        return acc;
      },
      {} as Record<string, string>,
    ) || {};

  return {
    hasError: !!error,
    errors,
  };
}
