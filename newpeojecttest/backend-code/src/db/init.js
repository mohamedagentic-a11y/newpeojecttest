const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const BCRYPT_ROUNDS = 10;

/**
 * Seed users. Passwords are NOT written here as literals: they are read from
 * the environment (SEED_MEMBER_PASSWORD / SEED_LIBRARIAN_PASSWORD). For the
 * demo accounts described in the spec, set both to the agreed demo password
 * in your .env file.
 */
const SEED_USERS = [
  {
    email: 'member@lib.com',
    fullName: 'Sarah',
    role: 'member',
    passwordEnv: process.env.PASSWORD_ENV ?? 'SEED_MEMBER_PASSWORD',
  },
  {
    email: 'librarian@lib.com',
    fullName: 'Librarian',
    role: 'librarian',
    passwordEnv: process.env.PASSWORD_ENV ?? 'SEED_LIBRARIAN_PASSWORD',
  },
];

const SEED_BOOKS = [
  { title: 'React Up and Running', author: 'Stoyan Stefanov', isbn: '978-1491931820' },
  { title: 'Node.js Design Patterns', author: 'Mario Casciaro', isbn: '978-1839214110' },
  { title: 'PostgreSQL: Up and Running', author: 'Regina Obe', isbn: '978-1491963418' },
  { title: 'Clean Code', author: 'Robert C. Martin', isbn: '978-0132350884' },
  { title: 'The Pragmatic Programmer', author: 'Andrew Hunt', isbn: '978-0135957059' },
  { title: 'Eloquent JavaScript', author: 'Marijn Haverbeke', isbn: '978-1593279509' },
];

async function applySchema() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  if (!sql.trim()) {
    throw new Error(`Schema file is empty: ${SCHEMA_PATH}`);
  }
  // Multi-statement text without parameters runs via the simple query protocol.
  await pool.query(sql);
}

async function seedUsers(client) {
  for (const user of SEED_USERS) {
    const existing = await client.query(
      'SELECT 1 FROM users WHERE email = $1',
      [user.email]
    );
    if (existing.rowCount > 0) continue;

    const plain = process.env[user.passwordEnv];
    if (!plain) {
      throw new Error(
        `Cannot seed user ${user.email}: environment variable ${user.passwordEnv} is not set.`
      );
    }

    const hash = await bcrypt.hash(plain, BCRYPT_ROUNDS);
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [user.email, hash, user.fullName, user.role]
    );
    console.log(`[db:init] Seeded user ${user.email} (${user.role})`);
  }
}

async function seedBooks(client) {
  let inserted = 0;
  for (const book of SEED_BOOKS) {
    const result = await client.query(
      `INSERT INTO books (title, author, isbn, status)
       VALUES ($1, $2, $3, 'available')
       ON CONFLICT (isbn) DO NOTHING`,
      [book.title, book.author, book.isbn]
    );
    inserted += result.rowCount;
  }
  if (inserted > 0) {
    console.log(`[db:init] Seeded ${inserted} sample book(s)`);
  }
}

async function initDatabase() {
  console.log('[db:init] Applying schema...');
  await applySchema();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seedUsers(client);
    await seedBooks(client);
    await client.query('COMMIT');
    console.log('[db:init] Database ready');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db:init] Rollback failed:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { initDatabase };