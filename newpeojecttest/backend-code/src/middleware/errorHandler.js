const httpErrorModule = require('../utils/httpError');

const { HttpError } = httpErrorModule;

function isHttpError(err) {
  if (typeof HttpError === 'function' && err instanceof HttpError) return true;
  // Fallback duck-typing for errors that carry an explicit HTTP status.
  const status = err && (err.status || err.statusCode);
  return Number.isInteger(status) && status >= 400 && status < 600 && err.expose !== false;
}

function isZodError(err) {
  return Boolean(err) && (err.name === 'ZodError' || (Array.isArray(err.issues) && typeof err.flatten === 'function'));
}

function formatZodMessage(err) {
  const issues = Array.isArray(err.issues) ? err.issues : [];
  if (issues.length === 0) return 'Invalid request.';
  return issues
    .map((issue) => {
      const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join('.') : null;
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

function uniqueViolationMessage(err) {
  const constraint = String((err && err.constraint) || '').toLowerCase();
  const detail = String((err && err.detail) || '').toLowerCase();
  if (constraint.includes('isbn') || detail.includes('(isbn)')) {
    return 'A book with this ISBN already exists.';
  }
  if (constraint.includes('email') || detail.includes('(email)')) {
    return 'A user with this email already exists.';
  }
  return 'Resource already exists.';
}

function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: {
      code: 404,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let status = 500;
  let message = 'Internal server error.';

  if (isZodError(err)) {
    status = 400;
    message = formatZodMessage(err);
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body.';
  } else if (err && err.code === '23505') {
    status = 409;
    message = uniqueViolationMessage(err);
  } else if (err && err.code === '22P02') {
    // invalid_text_representation, e.g. malformed UUID passed to a query
    status = 400;
    message = 'Invalid identifier format.';
  } else if (isHttpError(err)) {
    status = err.status || err.statusCode || 500;
    message = err.message || message;
  }

  if (status >= 500) {
    // Stack traces go to the server console only; never to the client.
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err && err.stack ? err.stack : err);
    message = 'Internal server error.';
  } else {
    console.warn(`[warn] ${req.method} ${req.originalUrl} -> ${status}: ${message}`);
  }

  return res.status(status).json({
    error: {
      code: status,
      message,
    },
  });
}

module.exports = { errorHandler, notFoundHandler };