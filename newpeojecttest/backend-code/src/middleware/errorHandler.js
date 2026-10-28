const { ZodError } = require('zod');
const { AppError } = require('../utils/AppError');

function sendError(res, status, message) {
  return res.status(status).json({
    error: {
      code: status,
      message,
    },
  });
}

function formatZodMessage(err) {
  const issues = Array.isArray(err.issues) ? err.issues : Array.isArray(err.errors) ? err.errors : [];
  if (issues.length === 0) {
    return 'Invalid request.';
  }
  return issues
    .map((issue) => {
      const path = Array.isArray(issue.path) && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${path}${issue.message}`;
    })
    .join('; ');
}

function isValidStatus(value) {
  return Number.isInteger(value) && value >= 400 && value <= 599;
}

function resolveAppErrorStatus(err) {
  const candidates = [err.statusCode, err.status, err.code];
  for (const candidate of candidates) {
    const num = typeof candidate === 'string' ? Number(candidate) : candidate;
    if (isValidStatus(num)) {
      return num;
    }
  }
  return 500;
}

function notFoundHandler(req, res, next) {
  return sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // Application-defined errors
  if (err instanceof AppError) {
    const status = resolveAppErrorStatus(err);
    if (status >= 500) {
      console.error(`[error] ${req.method} ${req.originalUrl}:`, err.stack || err);
      return sendError(res, status, 'Internal server error.');
    }
    return sendError(res, status, err.message || 'Request failed.');
  }

  // Validation errors
  if (err instanceof ZodError || (err && err.name === 'ZodError')) {
    return sendError(res, 400, formatZodMessage(err));
  }

  // Malformed JSON body from express.json()
  if (err && err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'Malformed JSON in request body.');
  }

  // PostgreSQL errors
  if (err && typeof err.code === 'string') {
    if (err.code === '23505') {
      const detail = err.constraint ? ` (${err.constraint})` : '';
      console.warn(`[warn] Unique violation${detail} on ${req.method} ${req.originalUrl}`);
      return sendError(res, 409, 'A record with the same unique value already exists.');
    }
    if (err.code === '23503') {
      return sendError(res, 400, 'Referenced record does not exist.');
    }
    if (err.code === '22P02') {
      return sendError(res, 400, 'Invalid identifier or value format.');
    }
  }

  // Errors carrying a client-safe HTTP status (e.g. from middleware libraries)
  const genericStatus = err && (err.statusCode || err.status);
  if (isValidStatus(genericStatus) && genericStatus < 500) {
    return sendError(res, genericStatus, err.expose && err.message ? err.message : 'Request failed.');
  }

  // Unknown / unexpected errors: log full stack server-side, hide details from client
  console.error(`[error] ${req.method} ${req.originalUrl}:`, (err && err.stack) || err);
  return sendError(res, 500, 'Internal server error.');
}

module.exports = { errorHandler, notFoundHandler };