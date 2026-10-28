'use strict';

/**
 * validate(schema, source = 'body')
 *
 * Express middleware factory that parses req[source] with a zod schema.
 * On success, req[source] is replaced with the parsed (coerced/stripped) value.
 * On failure, responds 400 with the API error envelope:
 *   { error: { code: 400, message: "..." } }
 */

const ALLOWED_SOURCES = new Set(['body', 'query', 'params', 'headers']);

function formatZodIssues(issues) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return 'Invalid request.';
  }
  return issues
    .map((issue) => {
      const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join('.') : null;
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

function validate(schema, source = 'body') {
  if (!schema || typeof schema.safeParse !== 'function') {
    throw new TypeError('validate(schema, source): schema must be a zod schema');
  }
  if (!ALLOWED_SOURCES.has(source)) {
    throw new TypeError(
      `validate(schema, source): source must be one of ${Array.from(ALLOWED_SOURCES).join(', ')}`
    );
  }

  return function validateMiddleware(req, res, next) {
    let result;
    try {
      const input = req[source] === undefined ? {} : req[source];
      result = schema.safeParse(input);
    } catch (err) {
      return next(err);
    }

    if (!result.success) {
      const issues = (result.error && (result.error.issues || result.error.errors)) || [];
      return res.status(400).json({
        error: {
          code: 400,
          message: formatZodIssues(issues),
        },
      });
    }

    try {
      req[source] = result.data;
    } catch (_assignErr) {
      // Some sources may be getter-only in certain environments; fall back to defining the property.
      Object.defineProperty(req, source, {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    return next();
  };
}

module.exports = { validate };