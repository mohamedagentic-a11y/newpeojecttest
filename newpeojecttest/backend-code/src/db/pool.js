const { Pool } = require('pg');
const envModule = require('../config/env');

// The env module exposes a named `config` export; fall back to the module object
// itself only in case it exports the settings directly as named properties.
const config = envModule.config || envModule;

const databaseUrl = config && config.databaseUrl;

if (!databaseUrl) {
  console.error('[db] DATABASE_URL (config.databaseUrl) is not set. Refusing to start.');
  throw new Error('Missing required configuration: databaseUrl');
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  // Errors on idle clients (e.g. the database restarted). Log; the pool will replace the client.
  console.error('[db] Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Run a single parameterised query against the pool.
 * @param {string} text SQL text with $1, $2 ... placeholders
 * @param {Array<any>} [params] parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  return pool.query(text, params);
}

/**
 * Run `fn` inside a transaction on a dedicated client.
 * Issues BEGIN, then COMMIT on success or ROLLBACK on any thrown error
 * (the error is re-thrown). The client is always released.
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
  if (typeof fn !== 'function') {
    throw new TypeError('withTransaction requires a function (client) => Promise');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db] ROLLBACK failed:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };