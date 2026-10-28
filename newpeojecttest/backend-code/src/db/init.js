const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const DEMO_USERS = [
  { email: 'member@lib.com', fullName: 'Sarah Member', role: 'member' },
  { email: 'librarian@lib.com', fullName: 'Liam Librarian', role: 'librarian' },
];

const SAMPLE_BOOKS = [
  { title: 'React Up and Running', author: 'Stoyan Stefanov', isbn: '978-1491931820' },
  { title: 'Node.js Design Patterns', author: 'Mario Casciaro', isbn: '978-1839214110' },
  { title: 'PostgreSQL: Up and Running', author: 'Regina Obe', isbn: '978-1491963418' },
  { title: 'Clean Code', author: 'Robert C. Martin', isbn: '978-0132350884' },
  { title: 'The Pragmatic Programmer', author: 'David Thomas', isbn: '978-0135957059' },
  { title: 'Eloquent JavaScript', author: 'Marijn Haverbeke', isbn: '978-1593279509' },
  { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', isbn: '978-1449373320' },
  { title: 'You Don\'t Know JS Yet', author: 'Kyle Simpson', isbn: '978-1091210099' },
];

async function runSchema(client) {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  if (sql.trim().length === 0) {
    console.warn('[db:init] schema.sql is empty; skipping schema creation');
    return;
  }
  await client.query(sql);
  console.log('[db:init] schema applied');
}

async function tableIsEmpty(client, table) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return rows[0].count === 0;
}

async function seedUsers(client) {
  if (!(await tableIsEmpty(client, 'users'))) {
    console.log('[db:init] users table not empty; skipping user seed');
    return;
  }

  // The demo password is supplied through configuration, never written in code.
  const demoPassword = process.env.DEMO_USER_PASSWORD;
  if (!demoPassword) {
    throw new Error(
      '[db:init] DEMO_USER_PASSWORD is not set; it is required to seed the demo users (member@lib.com, librarian@lib.com).'
    );
  }

  const passwordHash = await bcrypt.hash(demoPassword, 10);

  for (const user of DEMO_USERS) {
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [user.email, passwordHash, user.fullName, user.role]
    );
  }
  console.log(`[db:init] seeded ${DEMO_USERS.length} demo users`);
}

async function seedBooks(client) {
  if (!(await tableIsEmpty(client, 'books'))) {
    console.log('[db:init] books table not empty; skipping book seed');
    return;
  }

  for (const book of SAMPLE_BOOKS) {
    await client.query(
      `INSERT INTO books (title, author, isbn, status)
       VALUES ($1, $2, $3, 'available')
       ON CONFLICT (isbn) DO NOTHING`,
      [book.title, book.author, book.isbn]
    );
  }
  console.log(`[db:init] seeded ${SAMPLE_BOOKS.length} sample books`);
}

async function initDatabase() {
  const client = await pool.connect();
  try {
    await runSchema(client);

    await client.query('BEGIN');
    try {
      await seedUsers(client);
      await seedBooks(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    console.log('[db:init] database initialisation complete');
  } catch (err) {
    console.error('[db:init] database initialisation failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { initDatabase };