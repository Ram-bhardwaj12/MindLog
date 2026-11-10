import { ApiError } from '../utils/ApiError.js';

/**
 * Reusable Express middleware factory that validates request body against a Zod schema.
 * Replaces req.body with the sanitized/parsed result (stripping extra fields)
 * or forwards an ApiError.validationError (HTTP 400) with field-level details.
 *
 * @param {import('zod').ZodSchema} schema - Zod validation schema
 * @returns {import('express').RequestHandler} Express middleware
 */
export function validate(schema) {
  return function (req, res, next) {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));

      return next(ApiError.validationError('Validation failed', details));
    }

    // Replace body with stripped, validated data
    req.body = result.data;
    next();
  };
}

