const express = require('express');

const authControllerModule = require('../controllers/authController');
const validateModule = require('../middleware/validate');
const authModule = require('../middleware/auth');
const schemasModule = require('../validators/schemas');

/**
 * Resolve a named export from a module, trying a list of candidate names.
 * Throws at startup if none is present so a wiring mistake fails loudly
 * instead of producing a route that silently does nothing.
 */
function pick(mod, candidates, label) {
  for (const name of candidates) {
    const parts = name.split('.');
    let value = mod;
    for (const part of parts) {
      value = value == null ? undefined : value[part];
    }
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  throw new Error(
    `authRoutes: could not resolve ${label} (tried: ${candidates.join(', ')})`
  );
}

const login = pick(
  authControllerModule,
  ['login', 'authController.login'],
  'authController.login'
);
const logout = pick(
  authControllerModule,
  ['logout', 'authController.logout'],
  'authController.logout'
);
const validate = pick(
  validateModule,
  ['validate', 'validateBody', 'validateRequest'],
  'validate middleware'
);
const authenticate = pick(
  authModule,
  ['authenticate', 'requireAuth', 'authMiddleware', 'verifyToken', 'auth'],
  'authentication middleware'
);
const loginSchema = pick(
  schemasModule,
  ['loginSchema', 'schemas.loginSchema', 'schemas.login', 'authSchemas.login'],
  'login schema'
);

if (typeof login !== 'function' || typeof logout !== 'function') {
  throw new Error('authRoutes: authController login/logout must be functions');
}
if (typeof validate !== 'function' || typeof authenticate !== 'function') {
  throw new Error('authRoutes: validate and authenticate must be functions');
}

/**
 * Wrap async handlers so rejected promises reach Express error handling.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.then === 'function') {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

const authRoutes = express.Router();

// POST /api/v1/auth/login — public, body validated against loginSchema
authRoutes.post('/login', validate(loginSchema), asyncHandler(login));

// POST /api/v1/auth/logout — requires a valid bearer token
authRoutes.post('/logout', authenticate, asyncHandler(logout));

module.exports = { authRoutes };