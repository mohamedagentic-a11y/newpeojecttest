/* Authentication service: verifies email/password credentials and issues a signed JWT. */
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userRepositoryModule = require('../repositories/userRepository');
const envModule = require('../config/env');
const httpErrorModule = require('../utils/httpError');

// ---- Resolve dependencies defensively against their named exports ----

const config = envModule.config || envModule.env || envModule;

function findUserByEmail(email) {
  const fn =
    userRepositoryModule.findByEmail ||
    userRepositoryModule.findUserByEmail ||
    userRepositoryModule.getByEmail ||
    userRepositoryModule.getUserByEmail ||
    (userRepositoryModule.userRepository && userRepositoryModule.userRepository.findByEmail
      ? userRepositoryModule.userRepository.findByEmail.bind(userRepositoryModule.userRepository)
      : null);
  if (typeof fn !== 'function') {
    throw new Error('userRepository does not expose a findByEmail function');
  }
  return fn(email);
}

function makeHttpError(status, message) {
  const HttpErrorClass = httpErrorModule.HttpError;
  if (typeof HttpErrorClass === 'function') {
    try {
      return new HttpErrorClass(status, message);
    } catch (_) {
      /* fall through */
    }
  }
  const factory =
    httpErrorModule.httpError ||
    httpErrorModule.createHttpError ||
    httpErrorModule.createError;
  if (typeof factory === 'function') {
    const err = factory(status, message);
    if (err instanceof Error) return err;
  }
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  err.code = status;
  return err;
}

function getJwtSecret() {
  const secret = config.jwtSecret || config.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret is not configured (config.jwtSecret / JWT_SECRET is required)');
  }
  return secret;
}

// Lazily computed hash of a random value, used to equalize timing when the user does not exist.
let dummyHash = null;
function getDummyHash() {
  if (!dummyHash) {
    dummyHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
  }
  return dummyHash;
}

const INVALID_CREDENTIALS = 'Invalid email or password.';

/**
 * Authenticate a user by email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: {id: string, name: string, role: string}}>}
 */
async function login(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw makeHttpError(401, INVALID_CREDENTIALS);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  const storedHash = user ? user.password_hash || user.passwordHash : null;

  if (!user || !storedHash) {
    // Perform a comparison anyway to reduce user-enumeration via timing.
    await bcrypt.compare(password, getDummyHash());
    throw makeHttpError(401, INVALID_CREDENTIALS);
  }

  const ok = await bcrypt.compare(password, storedHash);
  if (!ok) {
    throw makeHttpError(401, INVALID_CREDENTIALS);
  }

  const id = user.id || user.user_id || user.userId;
  const name = user.name || user.full_name || user.fullName || '';
  const role = user.role;

  const token = jwt.sign({ sub: id, role, name }, getJwtSecret(), {
    expiresIn: config.jwtExpiresIn || config.JWT_EXPIRES_IN || '24h',
  });

  return {
    token,
    user: { id, name, role },
  };
}

module.exports = { login };