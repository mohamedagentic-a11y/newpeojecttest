const { pool } = require('../db/pool');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const USER_COLUMNS = `
  user_id AS id,
  user_id,
  email,
  password_hash,
  full_name,
  full_name AS name,
  role
`;

/**
 * Find a user by email (case-insensitive).
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findByEmail(email) {
  if (typeof email !== 'string' || email.trim() === '') {
    return null;
  }
  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email.trim()]
  );
  return rows[0] || null;
}

/**
 * Find a user by id (UUID).
 * @param {string} id
 * @returns {Promise<object|null>}
 */
async function findById(id) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    return null;
  }
  const { rows } = await pool.query(
    `SELECT ${USER_COLUMNS} FROM users WHERE user_id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { findByEmail, findById };