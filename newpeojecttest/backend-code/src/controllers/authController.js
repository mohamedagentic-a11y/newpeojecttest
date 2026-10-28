'use strict';

/**
 * Auth controller.
 *
 * login  -> POST /api/v1/auth/login  -> 200 { data: { token, user } }
 * logout -> POST /api/v1/auth/logout -> 200 { data: { success: true } }
 *
 * The JWT is stateless, so logout only acknowledges the request; the client
 * discards the token it holds in localStorage.
 *
 * Errors are forwarded to the centralized error middleware with an HTTP status
 * attached, so it can render { error: { code, message } }.
 */

const { z } = require('zod');
const authService = require('../services/authService');

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Invalid email format.'),
  password: z.string().min(1, 'Password is required.'),
});

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  err.code = status;
  err.expose = true;
  return err;
}

/**
 * Resolve the service's credential-checking function. The service exposes it
 * as a named export; accept the common names so this controller binds to
 * whichever one the service declares.
 */
function resolveLoginFn() {
  const fn =
    (typeof authService.login === 'function' && authService.login) ||
    (typeof authService.authenticate === 'function' && authService.authenticate) ||
    (typeof authService.loginUser === 'function' && authService.loginUser) ||
    (typeof authService.authenticateUser === 'function' && authService.authenticateUser);
  if (!fn) {
    throw httpError(500, 'Authentication service is not available.');
  }
  return fn;
}

function toPublicUser(user) {
  if (!user || typeof user !== 'object') return user;
  return {
    id: user.id ?? user.user_id,
    name: user.name ?? user.full_name,
    email: user.email,
    role: user.role,
  };
}

async function login(req, res, next) {
  try {
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(' ') || 'Invalid request body.';
      throw httpError(400, message);
    }

    const { email, password } = parsed.data;
    const loginFn = resolveLoginFn();

    let result;
    try {
      result = await loginFn(email, password);
      // Some service signatures take a single credentials object.
      if (result === undefined && loginFn.length <= 1) {
        result = await loginFn({ email, password });
      }
    } catch (err) {
      if (err && (err.status || err.statusCode)) throw err;
      if (err && /invalid|credential|unauthori/i.test(String(err.message || ''))) {
        throw httpError(401, 'Invalid email or password.');
      }
      throw err;
    }

    if (!result || !result.token) {
      throw httpError(401, 'Invalid email or password.');
    }

    return res.status(200).json({
      data: {
        token: result.token,
        user: toPublicUser(result.user),
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    return res.status(200).json({ data: { success: true } });
  } catch (err) {
    return next(err);
  }
}

module.exports = { login, logout };