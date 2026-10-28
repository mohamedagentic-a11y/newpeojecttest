'use strict';

/**
 * Authentication and authorization middleware.
 *
 * authenticate      - verifies the Bearer JWT and sets req.user = { id, role, name }.
 * requireRole(...r) - responds 403 when the authenticated user's role is not allowed.
 *
 * Access is default deny: any request without a valid token gets 401, and
 * requireRole denies when no roles are listed or req.user is missing.
 */

const jwt = require('jsonwebtoken');
const envModule = require('../config/env');
const AppErrorModule = require('../utils/AppError');

const env = envModule.env || envModule.config || envModule;
const AppError = AppErrorModule.AppError || AppErrorModule;

const VALID_ROLES = Object.freeze(['member', 'librarian']);

function resolveJwtSecret() {
  const secret =
    (env && (env.JWT_SECRET || env.jwtSecret || (env.jwt && env.jwt.secret))) ||
    process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string') {
    throw new Error('JWT_SECRET is not configured. Set it in the environment before starting the server.');
  }
  return secret;
}

// Fail fast at load time when the signing secret is absent.
const JWT_SECRET = resolveJwtSecret();

function makeError(status, message) {
  let err;
  try {
    err = new AppError(message, status);
  } catch (e) {
    err = new Error(message);
  }
  // Normalise regardless of AppError's argument order.
  err.message = message;
  err.statusCode = status;
  err.status = status;
  return err;
}

function extractBearerToken(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

function authenticate(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return next(makeError(401, 'Authentication required.'));
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    const message = err && err.name === 'TokenExpiredError' ? 'Token has expired.' : 'Invalid token.';
    return next(makeError(401, message));
  }

  if (!payload || typeof payload !== 'object') {
    return next(makeError(401, 'Invalid token.'));
  }

  const id = payload.id || payload.sub || payload.userId || payload.user_id;
  const role = payload.role;
  const name = payload.name || payload.fullName || payload.full_name || '';

  if (!id || !VALID_ROLES.includes(role)) {
    return next(makeError(401, 'Invalid token.'));
  }

  req.user = { id: String(id), role, name: String(name) };
  return next();
}

function requireRole(...roles) {
  const allowed = roles.flat().filter((r) => typeof r === 'string');
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(makeError(401, 'Authentication required.'));
    }
    if (allowed.length === 0 || !allowed.includes(req.user.role)) {
      return next(makeError(403, 'You do not have permission to perform this action.'));
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };