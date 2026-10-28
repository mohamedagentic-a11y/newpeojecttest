const express = require('express');

const authControllerModule = require('../controllers/authController');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { loginSchema } = require('../validators/schemas');

// The controller exposes its handlers as named exports. Accept either flat
// named handlers ({ login, logout }) or a named controller object
// ({ authController: { login, logout } }).
const controller =
  authControllerModule && authControllerModule.authController
    ? authControllerModule.authController
    : authControllerModule;

function requireHandler(name) {
  const fn = controller && controller[name];
  if (typeof fn !== 'function') {
    throw new Error(`authController is missing the "${name}" handler`);
  }
  return fn;
}

const login = requireHandler('login');
const logout = requireHandler('logout');

// Forward rejected promises from async handlers to the centralized error middleware.
const asyncHandler = (fn) => (req, res, next) => {
  try {
    const result = fn(req, res, next);
    if (result && typeof result.then === 'function') {
      result.catch(next);
    }
  } catch (err) {
    next(err);
  }
};

const authRouter = express.Router();

// POST /api/v1/auth/login — public; body validated against loginSchema.
authRouter.post('/login', validate(loginSchema), asyncHandler(login));

// POST /api/v1/auth/logout — requires a valid Bearer token.
authRouter.post('/logout', authenticate, asyncHandler(logout));

module.exports = { authRouter };