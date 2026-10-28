require('dotenv').config();

/**
 * Centralised application configuration.
 * Credentials (DATABASE_URL, JWT_SECRET) are required and have no fallback:
 * the process exits with an error if they are missing.
 */

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === '') {
    // eslint-disable-next-line no-console
    console.error(`[config] Missing required environment variable: ${name}`);
    throw new Error(`Missing required environment variable: ${name}`);
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

function toInt(name, defaultValue) {
  const raw = optional(name, undefined);
  if (raw === undefined) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer, got "${raw}"`);
  }
  return parsed;
}

function parseCorsOrigin(raw) {
  if (raw === '*') return '*';
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length === 1 ? list[0] : list;
}

const config = Object.freeze({
  nodeEnv: optional('NODE_ENV', 'development'),
  port: toInt('PORT', 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '24h'),
  loanPeriodDays: toInt('LOAN_PERIOD_DAYS', 14),
  corsOrigin: parseCorsOrigin(optional('CORS_ORIGIN', 'http://localhost:5173')),
});

module.exports = { config };