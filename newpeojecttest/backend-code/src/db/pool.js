const { Pool } = require('pg');
const { config } = require('../config/env');

if (!config || !config.databaseUrl) {
  throw new Error('DATABASE_URL is not configured: config.databaseUrl is required to create the database pool.');
}

const pool = new Pool({
  connectionString: config.databaseUrl,
});

pool.on('error', (err) => {
  // Errors on idle clients should not crash the process silently; log them.
  console.error('Unexpected PostgreSQL pool error:', err);
});

/**
 * Run a single parameterized query on the pool.
 * @param {string} text SQL text with $1..$n placeholders
 * @param {Array<unknown>} [params] parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run fn(client) inside a transaction: BEGIN, fn, COMMIT; ROLLBACK on error.
 * The client is always released back to the pool.
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withTransaction(fn) {
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
      console.error('Failed to roll back transaction:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };