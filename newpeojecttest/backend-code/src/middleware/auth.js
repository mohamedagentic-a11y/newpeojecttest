'use strict';

const jwt = require('jsonwebtoken');
const envModule = require('../config/env');
const httpErrorModule = require('../utils/httpError');

/**
 * Resolve the configuration object exported by config/env.js.
 * The module has no default export; it exposes a named export.
 */
function resolveConfig() {
  return envModule.env || envModule.config || envModule;
}

/**
 * Resolve the JWT signing secret from configuration (or the environment).
 * There is deliberately no fallback value: a missing secret is a fatal
 * configuration error.
 */
let cachedSecret = null;
function getJwtSecret() {
  if (cachedSecret) return cachedSecret;
  const config = resolveConfig() || {};
  const secret =
    config.JWT_SECRET ||
    config.jwtSecret ||
    (config.jwt && (config.jwt.secret || config.jwt.SECRET)) ||
    process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured. Set it in the environment before starting the server.');
  }
  cachedSecret = secret;
  return cachedSecret;
}

/**
 * Build an HTTP error using whatever utils/httpError.js provides, and make
 * sure the status is present under the common property names so the
 * centralized error middleware can render {error:{code,message}}.
 */
function makeError(status, message) {
  let err;
  const { HttpError, httpError, createHttpError } = httpErrorModule;
  try {
    if (typeof HttpError === 'function') {
      err = new HttpError(status, message);
    } else if (typeof httpError === 'function') {
      err = httpError(status, message);
    } else if (typeof createHttpError === 'function') {
      err = createHttpError(status, message);
    }
  } catch (_) {
    err = undefined;
  }
  if (!(err instanceof Error)) {
    err = new Error(message);
  }
  if (err.status === undefined) err.status = status;
  if (err.statusCode === undefined) err.statusCode = status;
  if (err.code === undefined) err.code = status;
  if (!err.message) err.message = message;
  return err;
}

/**
 * Verifies the Bearer JWT from the Authorization header and sets
 * req.user = { id, role, name }. Responds 401 otherwise.
 */
function authenticate(req, res, next) {
  const header = req.headers && req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return next(makeError(401, 'Authentication required.'));
  }

  const [scheme, token] = header.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return next(makeError(401, 'Authorization header must be in the form: Bearer <token>.'));
  }

  let secret;
  try {
    secret = getJwtSecret();
  } catch (configErr) {
    return next(makeError(500, configErr.message));
  }

  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch (verifyErr) {
    const message =
      verifyErr && verifyErr.name === 'TokenExpiredError'
        ? 'Token has expired. Please sign in again.'
        : 'Invalid authentication token.';
    return next(makeError(401, message));
  }

  if (!payload || typeof payload !== 'object') {
    return next(makeError(401, 'Invalid authentication token.'));
  }

  const id = payload.id || payload.sub || payload.userId || payload.user_id;
  const role = payload.role;
  const name = payload.name || payload.fullName || payload.full_name || '';

  if (!id || !role) {
    return next(makeError(401, 'Invalid authentication token.'));
  }

  req.user = { id: String(id), role: String(role), name: String(name) };
  return next();
}

/**
 * Returns middleware that allows the request only when req.user.role is one
 * of the given roles. 401 if not authenticated, 403 if the role does not match.
 */
function requireRole(...roles) {
  const allowed = roles.flat().filter(Boolean);
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(makeError(401, 'Authentication required.'));
    }
    if (!allowed.includes(req.user.role)) {
      return next(makeError(403, 'You do not have permission to perform this action.'));
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };