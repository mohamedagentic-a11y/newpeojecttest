const { pool } = require('../db/pool');

const BOOK_COLUMNS = `
  book_id AS id,
  title,
  author,
  isbn,
  status
`;

const UPDATABLE_FIELDS = ['title', 'author', 'isbn', 'status'];

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function executor(client) {
  return client || pool;
}

const bookRepository = {
  /**
   * Search the catalogue.
   * q      -> ILIKE over title and isbn
   * author -> ILIKE over author
   * status -> exact match ('available' | 'borrowed')
   */
  async search({ q, author, status } = {}, client) {
    const conditions = [];
    const params = [];

    if (q && String(q).trim() !== '') {
      params.push(`%${escapeLike(String(q).trim())}%`);
      const idx = params.length;
      conditions.push(`(title ILIKE $${idx} ESCAPE '\\' OR isbn ILIKE $${idx} ESCAPE '\\')`);
    }

    if (author && String(author).trim() !== '') {
      params.push(`%${escapeLike(String(author).trim())}%`);
      conditions.push(`author ILIKE $${params.length} ESCAPE '\\'`);
    }

    if (status && String(status).trim() !== '') {
      params.push(String(status).trim());
      conditions.push(`status = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT ${BOOK_COLUMNS} FROM books ${where} ORDER BY title ASC`;

    const { rows } = await executor(client).query(sql, params);
    return rows;
  },

  async findById(id, client) {
    const { rows } = await executor(client).query(
      `SELECT ${BOOK_COLUMNS} FROM books WHERE book_id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Locks the book row for the duration of the caller's transaction.
   * Must be called with a client that has an open transaction (BEGIN).
   */
  async findByIdForUpdate(client, id) {
    if (!client) {
      throw new Error('findByIdForUpdate requires a transaction client');
    }
    const { rows } = await client.query(
      `SELECT ${BOOK_COLUMNS} FROM books WHERE book_id = $1 FOR UPDATE`,
      [id]
    );
    return rows[0] || null;
  },

  async create({ title, author, isbn, status }, client) {
    const { rows } = await executor(client).query(
      `INSERT INTO books (title, author, isbn, status)
       VALUES ($1, $2, $3, COALESCE($4, 'available'))
       RETURNING ${BOOK_COLUMNS}`,
      [title, author, isbn, status || null]
    );
    return rows[0];
  },

  async update(id, fields = {}, client) {
    const sets = [];
    const params = [];

    for (const key of UPDATABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(fields, key) && fields[key] !== undefined) {
        params.push(fields[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }

    if (sets.length === 0) {
      return this.findById(id, client);
    }

    params.push(id);
    const { rows } = await executor(client).query(
      `UPDATE books SET ${sets.join(', ')}
       WHERE book_id = $${params.length}
       RETURNING ${BOOK_COLUMNS}`,
      params
    );
    return rows[0] || null;
  },

  async remove(id, client) {
    const { rows } = await executor(client).query(
      `DELETE FROM books WHERE book_id = $1 RETURNING ${BOOK_COLUMNS}`,
      [id]
    );
    return rows[0] || null;
  },

  async setStatus(client, id, status) {
    const { rows } = await executor(client).query(
      `UPDATE books SET status = $1 WHERE book_id = $2 RETURNING ${BOOK_COLUMNS}`,
      [status, id]
    );
    return rows[0] || null;
  },
};

module.exports = { bookRepository };