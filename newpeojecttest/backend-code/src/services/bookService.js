'use strict';

const { bookRepository } = require('../repositories/bookRepository');
const { AppError } = require('../utils/AppError');

const VALID_STATUSES = ['available', 'borrowed'];

/**
 * Resolve a repository method by trying a list of plausible names.
 * Throws a 500 AppError if none is implemented.
 */
function repoFn(names) {
  for (const name of names) {
    if (bookRepository && typeof bookRepository[name] === 'function') {
      return bookRepository[name].bind(bookRepository);
    }
  }
  throw new AppError(
    `Book repository does not implement any of: ${names.join(', ')}`,
    500
  );
}

/**
 * Map a database row to the public book shape.
 */
function mapBook(row) {
  if (!row) return null;
  return {
    id: row.book_id !== undefined ? row.book_id : row.id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    status: row.status,
  };
}

function translateDbError(err) {
  if (err && err.code === '23505') {
    return new AppError('A book with this ISBN already exists.', 409);
  }
  if (err && err.code === '22P02') {
    return new AppError('Invalid book identifier.', 400);
  }
  return err;
}

function cleanString(value) {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

async function getBookOrThrow(id) {
  const findById = repoFn(['findById', 'getById', 'findOne']);
  let row;
  try {
    row = await findById(id);
  } catch (err) {
    throw translateDbError(err);
  }
  if (!row) {
    throw new AppError('Book not found.', 404);
  }
  return row;
}

const bookService = {
  /**
   * Search and filter the catalogue.
   * @param {{ q?: string, keyword?: string, author?: string, status?: string }} filters
   */
  async searchBooks(filters = {}) {
    const keyword = cleanString(filters.q !== undefined ? filters.q : filters.keyword);
    const author = cleanString(filters.author);
    let status = cleanString(filters.status);
    if (status) {
      status = status.toLowerCase();
      if (!VALID_STATUSES.includes(status)) {
        throw new AppError(
          `Invalid status filter. Expected one of: ${VALID_STATUSES.join(', ')}.`,
          400
        );
      }
    }

    const search = repoFn(['search', 'findAll', 'searchBooks', 'find']);
    let rows;
    try {
      rows = await search({ q: keyword, keyword, author, status });
    } catch (err) {
      throw translateDbError(err);
    }
    return (Array.isArray(rows) ? rows : []).map(mapBook);
  },

  async getBookById(id) {
    const row = await getBookOrThrow(id);
    return mapBook(row);
  },

  /**
   * Librarian: create a new book. New books start as 'available'.
   */
  async createBook({ title, author, isbn } = {}) {
    const data = {
      title: cleanString(title),
      author: cleanString(author),
      isbn: cleanString(isbn),
      status: 'available',
    };
    if (!data.title || !data.author || !data.isbn) {
      throw new AppError('Title, author and ISBN are required.', 400);
    }

    const create = repoFn(['create', 'insert', 'createBook']);
    let row;
    try {
      row = await create(data);
    } catch (err) {
      throw translateDbError(err);
    }
    return mapBook(row);
  },

  /**
   * Librarian: update title/author/isbn of an existing book.
   * Status is managed by the loan workflow and is not editable here.
   */
  async updateBook(id, updates = {}) {
    await getBookOrThrow(id);

    const data = {};
    for (const key of ['title', 'author', 'isbn']) {
      if (updates[key] !== undefined) {
        const v = cleanString(updates[key]);
        if (!v) {
          throw new AppError(`${key} cannot be empty.`, 400);
        }
        data[key] = v;
      }
    }
    if (Object.keys(data).length === 0) {
      throw new AppError('No updatable fields supplied.', 400);
    }

    const update = repoFn(['update', 'updateById', 'updateBook']);
    let row;
    try {
      row = await update(id, data);
    } catch (err) {
      throw translateDbError(err);
    }
    if (!row) {
      throw new AppError('Book not found.', 404);
    }
    return mapBook(row);
  },

  /**
   * Librarian: delete a book. Refused with 409 while the book is borrowed.
   */
  async deleteBook(id) {
    const existing = await getBookOrThrow(id);
    if (existing.status === 'borrowed') {
      throw new AppError('Cannot delete a book that is currently borrowed.', 409);
    }

    const remove = repoFn(['remove', 'delete', 'deleteById', 'deleteBook']);
    let result;
    try {
      result = await remove(id);
    } catch (err) {
      if (err && err.code === '23503') {
        throw new AppError('Cannot delete a book that has loan records.', 409);
      }
      throw translateDbError(err);
    }
    if (result === false || result === 0 || result === null) {
      throw new AppError('Book not found.', 404);
    }
    return { id: mapBook(existing).id, deleted: true };
  },

  mapBook,
};

module.exports = { bookService };