const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { userRepository } = require('../repositories/userRepository');
const { env } = require('../config/env');
const { AppError } = require('../utils/AppError');

const TOKEN_EXPIRY = '24h';
const INVALID_CREDENTIALS = 'Invalid email or password.';

function getJwtSecret() {
  const secret =
    (env && (env.jwtSecret || env.JWT_SECRET || (env.jwt && env.jwt.secret))) ||
    process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured. Set it in the environment before starting the server.');
  }
  return secret;
}

async function findUserByEmail(email) {
  const repo = userRepository || {};
  if (typeof repo.findByEmail === 'function') return repo.findByEmail(email);
  if (typeof repo.getByEmail === 'function') return repo.getByEmail(email);
  if (typeof repo.findUserByEmail === 'function') return repo.findUserByEmail(email);
  throw new Error('userRepository does not provide a lookup-by-email method.');
}

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id || row.user_id,
    name: row.name || row.full_name || row.fullName,
    role: row.role,
    passwordHash: row.passwordHash || row.password_hash,
  };
}

async function login(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new AppError(INVALID_CREDENTIALS, 401);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const row = await findUserByEmail(normalizedEmail);
  const user = normalizeUser(row);

  if (!user || !user.passwordHash) {
    throw new AppError(INVALID_CREDENTIALS, 401);
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new AppError(INVALID_CREDENTIALS, 401);
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    getJwtSecret(),
    { expiresIn: TOKEN_EXPIRY }
  );

  return {
    token,
    user: { id: user.id, name: user.name, role: user.role },
  };
}

const authService = { login };

module.exports = { authService };