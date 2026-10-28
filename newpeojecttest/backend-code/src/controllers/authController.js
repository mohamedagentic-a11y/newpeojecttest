'use strict';

const { z } = require('zod');
const { authService } = require('../services/authService');

/**
 * Request body schema for POST /api/v1/auth/login.
 */
const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .min(1, 'Email is required.')
    .email('Email must be a valid email address.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.'),
});

/**
 * Send an error in the API's common error format.
 */
function sendError(res, code, message) {
  return res.status(code).json({ error: { code, message } });
}

/**
 * Resolve the HTTP status an error carries, if any.
 */
function statusOf(err) {
  const status = err && (err.status || err.statusCode);
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : null;
}

/**
 * Strip anything sensitive from a user record before it leaves the API.
 * The response shape is { id, name, role } (plus email when available).
 */
function toPublicUser(user) {
  if (!user) return null;
  const publicUser = {
    id: user.id ?? user.user_id,
    name: user.name ?? user.full_name,
    role: user.role,
  };
  if (user.email) publicUser.email = user.email;
  return publicUser;
}

const authController = {
  /**
   * POST /api/v1/auth/login
   * Body: { email, password }
   * 200: { data: { token, user } }
   * 400: invalid body; 401: bad credentials
   */
  async login(req, res, next) {
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const message =
        (parsed.error.issues[0] && parsed.error.issues[0].message) || 'Invalid request body.';
      return sendError(res, 400, message);
    }

    const { email, password } = parsed.data;

    try {
      const result = await authService.login(email, password);

      if (!result || !result.token) {
        return sendError(res, 401, 'Invalid email or password.');
      }

      return res.status(200).json({
        data: {
          token: result.token,
          user: toPublicUser(result.user),
        },
      });
    } catch (err) {
      const status = statusOf(err);
      if (status && status < 500) {
        return sendError(res, status, err.message || 'Authentication failed.');
      }
      console.error('[authController.login] Unexpected error:', err);
      return next(err);
    }
  },

  /**
   * POST /api/v1/auth/logout
   * JWTs are stateless; the client discards its token.
   * 200: { data: { success: true } }
   */
  async logout(req, res) {
    return res.status(200).json({ data: { success: true } });
  },
};

module.exports = { authController };