const poolModule = require('../db/pool');

const { pool } = poolModule;

const BOOK_COLUMNS = 'book_id AS id, title, author, isbn, status';

function getExecutor(client) {
  if (client && typeof client.query === 'function') return client;
  if (pool && typeof pool.query === 'function') return pool;
  if (typeof poolModule.query === 'function') return poolModule;
  throw new Error('Database pool is not available from db/pool');
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    status: row.status,
  };
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function search({ q, author, status } = {}) {
  const conditions = [];
  const params = [];

  if (q && String(q).trim() !== '') {
    params.push(`%${escapeLike(String(q).trim())}%`);
    const idx = params.length;
    conditions.push(`(title ILIKE $${idx} OR isbn ILIKE $${idx})`);
  }

  if (author && String(author).trim() !== '') {
    params.push(`%${escapeLike(String(author).trim())}%`);
    conditions.push(`author ILIKE $${params.length}`);
  }

  if (status && String(status).trim() !== '') {
    params.push(String(status).trim());
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT ${BOOK_COLUMNS} FROM books ${where} ORDER BY title ASC`;
  const { rows } = await getExecutor().query(sql, params);
  return rows.map(mapRow);
}

async function findById(id) {
  const { rows } = await getExecutor().query(
    `SELECT ${BOOK_COLUMNS} FROM books WHERE book_id = $1`,
    [id]
  );
  return mapRow(rows[0]);
}

async function findByIdForUpdate(client, id) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('findByIdForUpdate requires a transaction client');
  }
  const { rows } = await client.query(
    `SELECT ${BOOK_COLUMNS} FROM books WHERE book_id = $1 FOR UPDATE`,
    [id]
  );
  return mapRow(rows[0]);
}

async function create({ title, author, isbn, status }) {
  const { rows } = await getExecutor().query(
    `INSERT INTO books (title, author, isbn, status)
     VALUES ($1, $2, $3, $4)
     RETURNING ${BOOK_COLUMNS}`,
    [title, author, isbn, status || 'available']
  );
  return mapRow(rows[0]);
}

async function update(id, fields = {}) {
  const allowed = ['title', 'author', 'isbn', 'status'];
  const sets = [];
  const params = [];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(fields, key) && fields[key] !== undefined) {
      params.push(fields[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }

  if (sets.length === 0) {
    return findById(id);
  }

  params.push(id);
  const { rows } = await getExecutor().query(
    `UPDATE books SET ${sets.join(', ')} WHERE book_id = $${params.length}
     RETURNING ${BOOK_COLUMNS}`,
    params
  );
  return mapRow(rows[0]);
}

async function remove(id) {
  const { rowCount } = await getExecutor().query(
    'DELETE FROM books WHERE book_id = $1',
    [id]
  );
  return rowCount > 0;
}

async function setStatus(client, id, status) {
  const { rows } = await getExecutor(client).query(
    `UPDATE books SET status = $1 WHERE book_id = $2 RETURNING ${BOOK_COLUMNS}`,
    [status, id]
  );
  return mapRow(rows[0]);
}

module.exports = {
  search,
  findById,
  findByIdForUpdate,
  create,
  update,
  remove,
  setStatus,
};