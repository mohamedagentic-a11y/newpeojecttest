require('dotenv').config();

/**
 * Centralized application configuration.
 * Credentials (jwtSecret, databaseUrl) are REQUIRED and have no fallback values.
 * Non-sensitive settings have sensible defaults.
 */

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in the environment or in a .env file.`
    );
  }
  return String(value).trim();
}

function optional(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === '') {
    return defaultValue;
  }
  return String(value).trim();
}

function toPositiveInt(name, defaultValue) {
  const raw = optional(name, undefined);
  if (raw === undefined) return defaultValue;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer (got "${raw}").`);
  }
  return n;
}

function parseCorsOrigin(raw) {
  if (raw === '*') return '*';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length === 1 ? list[0] : list;
}

/**
 * @typedef {Object} AppConfig
 * @property {string} nodeEnv
 * @property {number} port
 * @property {string} databaseUrl
 * @property {string} jwtSecret
 * @property {string} jwtExpiresIn
 * @property {string|string[]} corsOrigin
 * @property {number} loanDays
 */

/** @type {AppConfig} */
const config = Object.freeze({
  nodeEnv: optional('NODE_ENV', 'development'),
  port: toPositiveInt('PORT', 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '24h'),
  corsOrigin: parseCorsOrigin(optional('CORS_ORIGIN', 'http://localhost:5173')),
  loanDays: toPositiveInt('LOAN_DAYS', 14),
});

module.exports = { config };