'use strict';

const { pool } = require('../db/pool');

/**
 * User repository — data access for the users table.
 *
 * Schema (see architecture/lld.md):
 *   users (
 *     user_id       UUID PRIMARY KEY,
 *     email         VARCHAR UNIQUE,
 *     password_hash VARCHAR,
 *     full_name     VARCHAR,
 *     role          ENUM('member', 'librarian')
 *   )
 *
 * All queries are parameterized. Each method optionally accepts a pg client
 * (e.g. one checked out for a transaction); otherwise the shared pool is used.
 */

const USER_COLUMNS = 'user_id, email, password_hash, full_name, role';

// Postgres error code for invalid text representation (e.g. malformed UUID).
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

/**
 * Map a database row to a user object used by services/controllers.
 * passwordHash is included for credential verification by the auth service;
 * it must never be sent in an API response.
 */
function mapRow(row) {
  if (!row) return null;
  return {
    id: row.user_id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.full_name,
    fullName: row.full_name,
    role: row.role,
  };
}

function executor(client) {
  return client || pool;
}

const userRepository = {
  /**
   * Find a user by email (case-insensitive).
   * @param {string} email
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<object|null>}
   */
  async findByEmail(email, client) {
    if (typeof email !== 'string' || email.trim() === '') {
      return null;
    }
    const sql = `SELECT ${USER_COLUMNS}
                   FROM users
                  WHERE LOWER(email) = LOWER($1)
                  LIMIT 1`;
    const result = await executor(client).query(sql, [email.trim()]);
    return mapRow(result.rows[0]);
  },

  /**
   * Find a user by id (UUID).
   * @param {string} id
   * @param {import('pg').PoolClient} [client]
   * @returns {Promise<object|null>}
   */
  async findById(id, client) {
    if (id === undefined || id === null || String(id).trim() === '') {
      return null;
    }
    const sql = `SELECT ${USER_COLUMNS}
                   FROM users
                  WHERE user_id = $1
                  LIMIT 1`;
    try {
      const result = await executor(client).query(sql, [String(id).trim()]);
      return mapRow(result.rows[0]);
    } catch (err) {
      // A malformed UUID cannot match any user; treat it as "not found".
      if (err && err.code === PG_INVALID_TEXT_REPRESENTATION) {
        return null;
      }
      throw err;
    }
  },
};

module.exports = { userRepository };