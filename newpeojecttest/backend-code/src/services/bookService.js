/**
 * Catalogue business logic.
 *
 * searchBooks(filters)            → list of books matching keyword / author / status
 * addBook(input, actor)           → creates a book (status 'available'), audits it
 * editBook(id, changes, actor)    → updates a book, 404 if missing, audits it
 * deleteBook(id, actor)           → deletes a book, 404 if missing, 409 if borrowed, audits it
 *
 * The repositories and httpError are imported as named exports. Their exact export
 * names are resolved defensively at load time so this service binds to whatever the
 * repository modules actually provide.
 */

const bookRepositoryModule = require('../repositories/bookRepository');
const auditLogRepositoryModule = require('../repositories/auditLogRepository');
const httpErrorModule = require('../utils/httpError');

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

function unwrapRepository(mod, preferredNames) {
  for (const name of preferredNames) {
    if (mod && mod[name] && typeof mod[name] === 'object') return mod[name];
  }
  return mod || {};
}

const bookRepository = unwrapRepository(bookRepositoryModule, ['bookRepository', 'BookRepository']);
const auditLogRepository = unwrapRepository(auditLogRepositoryModule, [
  'auditLogRepository',
  'AuditLogRepository',
]);

function pickFn(repo, names, label) {
  for (const name of names) {
    if (typeof repo[name] === 'function') return repo[name].bind(repo);
  }
  return function missing() {
    throw new Error(`bookService: repository function for "${label}" is not available (tried ${names.join(', ')})`);
  };
}

const repoSearch = pickFn(
  bookRepository,
  ['searchBooks', 'search', 'findBooks', 'findAll', 'listBooks', 'list', 'find'],
  'search books'
);
const repoFindById = pickFn(
  bookRepository,
  ['findBookById', 'findById', 'getBookById', 'getById', 'findOne', 'get'],
  'find book by id'
);
const repoCreate = pickFn(
  bookRepository,
  ['createBook', 'create', 'insertBook', 'insert', 'addBook', 'add'],
  'create book'
);
const repoUpdate = pickFn(
  bookRepository,
  ['updateBook', 'update', 'editBook', 'edit'],
  'update book'
);
const repoDelete = pickFn(
  bookRepository,
  ['deleteBook', 'delete', 'removeBook', 'remove', 'deleteById'],
  'delete book'
);
const auditWrite = pickFn(
  auditLogRepository,
  ['createAuditLog', 'insertAuditLog', 'addAuditLog', 'logAction', 'log', 'create', 'insert', 'record', 'add'],
  'write audit log'
);

function buildError(status, code, message) {
  const mod = httpErrorModule || {};
  const Ctor = mod.HttpError || mod.httpError || mod.default;

  // Helper-style exports (notFound, conflict, badRequest)
  const helperName = { 404: 'notFound', 409: 'conflict', 400: 'badRequest' }[status];
  if (helperName && typeof mod[helperName] === 'function') {
    try {
      const e = mod[helperName](message, code);
      if (e instanceof Error) return e;
    } catch (_) {
      /* fall through */
    }
  }

  if (typeof Ctor === 'function') {
    try {
      const e = new Ctor(status, message, code);
      if (e instanceof Error) {
        if (e.status === undefined && e.statusCode === undefined) e.status = status;
        if (!e.code) e.code = code;
        return e;
      }
    } catch (_) {
      /* fall through */
    }
    try {
      const e = Ctor(status, message, code);
      if (e instanceof Error) return e;
    } catch (_) {
      /* fall through */
    }
  }

  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBook(row) {
  if (!row) return row;
  return {
    id: row.id !== undefined ? row.id : row.book_id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    status: row.status,
  };
}

function actorId(actor) {
  if (!actor) return null;
  if (typeof actor === 'string') return actor;
  return actor.id || actor.userId || actor.user_id || actor.sub || null;
}

async function writeAudit(actor, action, bookId, details) {
  await auditWrite({
    userId: actorId(actor),
    action,
    entityType: 'book',
    entityId: bookId,
    details: details || null,
  });
}

function isUniqueViolation(err) {
  return err && err.code === '23505';
}

function cleanString(value) {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s.length ? s : undefined;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

async function searchBooks(filters = {}) {
  const normalized = {
    q: cleanString(filters.q ?? filters.keyword ?? filters.query),
    author: cleanString(filters.author),
    status: cleanString(filters.status),
  };
  const rows = await repoSearch(normalized);
  return (rows || []).map(toBook);
}

async function addBook(input, actor) {
  const book = {
    title: cleanString(input && input.title),
    author: cleanString(input && input.author),
    isbn: cleanString(input && input.isbn),
    status: 'available',
  };
  if (!book.title || !book.author || !book.isbn) {
    throw buildError(400, 'VALIDATION_ERROR', 'Title, author and ISBN are required.');
  }

  let created;
  try {
    created = await repoCreate(book);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw buildError(409, 'DUPLICATE_ISBN', 'A book with this ISBN already exists.');
    }
    throw err;
  }

  const result = toBook(created);
  await writeAudit(actor, 'BOOK_CREATED', result.id, {
    title: result.title,
    author: result.author,
    isbn: result.isbn,
  });
  return result;
}

async function editBook(id, changes, actor) {
  const existing = await repoFindById(id);
  if (!existing) {
    throw buildError(404, 'NOT_FOUND', 'Book not found.');
  }

  const patch = {};
  for (const field of ['title', 'author', 'isbn']) {
    const v = cleanString(changes && changes[field]);
    if (v !== undefined) patch[field] = v;
  }
  if (Object.keys(patch).length === 0) {
    throw buildError(400, 'VALIDATION_ERROR', 'No changes supplied.');
  }

  let updated;
  try {
    updated = await repoUpdate(id, patch);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw buildError(409, 'DUPLICATE_ISBN', 'A book with this ISBN already exists.');
    }
    throw err;
  }
  if (!updated) {
    throw buildError(404, 'NOT_FOUND', 'Book not found.');
  }

  const before = toBook(existing);
  const result = toBook(updated);
  await writeAudit(actor, 'BOOK_UPDATED', result.id, { before, changes: patch });
  return result;
}

async function deleteBook(id, actor) {
  const existing = await repoFindById(id);
  if (!existing) {
    throw buildError(404, 'NOT_FOUND', 'Book not found.');
  }
  if (existing.status === 'borrowed') {
    throw buildError(409, 'BOOK_BORROWED', 'This book is currently borrowed and cannot be deleted.');
  }

  let deleted;
  try {
    deleted = await repoDelete(id);
  } catch (err) {
    // FK violation: loans still reference this book
    if (err && err.code === '23503') {
      throw buildError(409, 'BOOK_IN_USE', 'This book has loan records and cannot be deleted.');
    }
    throw err;
  }
  if (deleted === false || deleted === 0 || deleted === null) {
    throw buildError(404, 'NOT_FOUND', 'Book not found.');
  }

  const book = toBook(existing);
  await writeAudit(actor, 'BOOK_DELETED', book.id, {
    title: book.title,
    author: book.author,
    isbn: book.isbn,
  });
  return { id: book.id, deleted: true };
}

module.exports = {
  searchBooks,
  addBook,
  editBook,
  deleteBook,
};