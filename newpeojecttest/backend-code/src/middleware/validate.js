'use strict';

const { AppError } = require('../utils/AppError');

/**
 * Build a readable message from a zod error.
 * @param {import('zod').ZodError} zodError
 * @returns {string}
 */
function formatZodError(zodError) {
  const issues = Array.isArray(zodError && zodError.issues) ? zodError.issues : [];
  if (issues.length === 0) {
    return 'Invalid request.';
  }
  return issues
    .map((issue) => {
      const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join('.') : null;
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

/**
 * validate(schema, source='body')
 * Parses req[source] with the given zod schema. On success the parsed
 * (and possibly coerced/stripped) value replaces req[source]. On failure
 * a 400 AppError is passed to the error handler.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} [source='body']
 */
function validate(schema, source = 'body') {
  if (!schema || typeof schema.safeParse !== 'function') {
    throw new Error('validate() requires a zod schema');
  }

  return function validateMiddleware(req, res, next) {
    const input = req[source] === undefined ? {} : req[source];
    const result = schema.safeParse(input);

    if (!result.success) {
      const message = formatZodError(result.error);
      const err = new AppError(message, 400);
      // Ensure consistent fields regardless of AppError constructor details.
      err.message = message;
      err.statusCode = 400;
      err.status = 400;
      err.details = result.error.issues;
      return next(err);
    }

    try {
      req[source] = result.data;
    } catch (_e) {
      // Some sources may be non-writable; keep parsed copy available instead.
    }
    req.validated = req.validated || {};
    req.validated[source] = result.data;

    return next();
  };
}

module.exports = { validate };