/**
 * Loan service: borrowing and returning books, and loan listings.
 *
 * Borrowing and returning run inside a single database transaction, and the
 * book row is locked with SELECT ... FOR UPDATE. Two members borrowing the
 * same copy at the same moment are therefore serialised, and only one of
 * them succeeds.
 */

'use strict';

const poolModule = require('../db/pool');
const bookRepository = require('../repositories/bookRepository');
const loanRepository = require('../repositories/loanRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const envModule = require('../config/env');
const httpErrorModule = require('../utils/httpError');

// ---------------------------------------------------------------------------
// Dependency resolution (tolerant of the exact export names)
// ---------------------------------------------------------------------------

const pool = poolModule.pool || poolModule.db || null;

function pickFn(mod, names) {
  if (!mod) return null;
  for (const n of names) {
    if (typeof mod[n] === 'function') return mod[n];
  }
  return null;
}

const withTransaction =
  pickFn(poolModule, ['withTransaction', 'transaction', 'runInTransaction']) ||
  (async function fallbackWithTransaction(fn) {
    if (!pool || typeof pool.connect !== 'function') {
      throw new Error('Database pool is not available for transactions');
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
      } catch (_) {
        /* ignore rollback failure */
      }
      throw err;
    } finally {
      client.release();
    }
  });

const poolQuery =
  pickFn(poolModule, ['query']) ||
  ((text, params) => {
    if (!pool) throw new Error('Database pool is not available');
    return pool.query(text, params);
  });

function resolveLoanDays() {
  const cfg = envModule.env || envModule.config || envModule;
  const raw =
    (cfg && (cfg.loanDays ?? cfg.LOAN_DAYS ?? cfg.loan_days)) ??
    process.env.LOAN_DAYS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

function httpError(status, message) {
  const Cls = httpErrorModule.HttpError || httpErrorModule.HTTPError;
  if (typeof Cls === 'function') {
    try {
      const e = new Cls(status, message);
      if (e instanceof Error) {
        if (e.status === undefined) e.status = status;
        if (e.statusCode === undefined) e.statusCode = status;
        return e;
      }
    } catch (_) {
      /* fall through */
    }
  }
  const factory = pickFn(httpErrorModule, ['httpError', 'createHttpError', 'createError']);
  if (factory) {
    const e = factory(status, message);
    if (e instanceof Error) return e;
  }
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  err.code = status;
  return err;
}

// ---------------------------------------------------------------------------
// Data helpers (prefer repository functions, fall back to parameterized SQL)
// ---------------------------------------------------------------------------

async function lockBook(client, bookId) {
  const fn = pickFn(bookRepository, ['findByIdForUpdate', 'lockById', 'getByIdForUpdate']);
  if (fn) return fn(client, bookId);
  const { rows } = await client.query(
    'SELECT * FROM books WHERE book_id = $1 FOR UPDATE',
    [bookId]
  );
  return rows[0] || null;
}

async function setBookStatus(client, bookId, status) {
  const fn = pickFn(bookRepository, ['updateStatus', 'setStatus']);
  if (fn) return fn(client, bookId, status);
  await client.query('UPDATE books SET status = $2 WHERE book_id = $1', [bookId, status]);
  return undefined;
}

async function findActiveLoanForUserAndBook(client, userId, bookId) {
  const fn = pickFn(loanRepository, [
    'findActiveByUserAndBook',
    'findActiveLoanByUserAndBook',
    'getActiveByUserAndBook',
  ]);
  if (fn) return fn(client, userId, bookId);
  const { rows } = await client.query(
    `SELECT * FROM loans
      WHERE user_id = $1 AND book_id = $2 AND return_date IS NULL
      LIMIT 1`,
    [userId, bookId]
  );
  return rows[0] || null;
}

async function insertLoan(client, userId, bookId, dueDate) {
  const fn = pickFn(loanRepository, ['create', 'insert', 'createLoan']);
  if (fn) return fn(client, { userId, bookId, dueDate });
  const { rows } = await client.query(
    `INSERT INTO loans (user_id, book_id, borrow_date, due_date)
     VALUES ($1, $2, NOW(), $3)
     RETURNING *`,
    [userId, bookId, dueDate]
  );
  return rows[0];
}

async function lockLoan(client, loanId) {
  const fn = pickFn(loanRepository, ['findByIdForUpdate', 'lockById', 'getByIdForUpdate']);
  if (fn) return fn(client, loanId);
  const { rows } = await client.query(
    'SELECT * FROM loans WHERE loan_id = $1 FOR UPDATE',
    [loanId]
  );
  return rows[0] || null;
}

async function markLoanReturned(client, loanId) {
  const fn = pickFn(loanRepository, ['markReturned', 'markAsReturned', 'setReturned']);
  if (fn) return fn(client, loanId);
  await client.query('UPDATE loans SET return_date = NOW() WHERE loan_id = $1', [loanId]);
  return undefined;
}

async function writeAudit(client, userId, action, details) {
  const fn = pickFn(auditLogRepository, ['create', 'insert', 'log', 'record', 'createEntry']);
  if (fn) return fn(client, { userId, action, details });
  await client.query(
    'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
    [userId, action, JSON.stringify(details || {})]
  );
  return undefined;
}

function field(row, ...names) {
  if (!row) return undefined;
  for (const n of names) {
    if (row[n] !== undefined) return row[n];
  }
  return undefined;
}

function isActive(loan) {
  const returned = field(loan, 'return_date', 'returnDate', 'returned_at', 'returnedAt');
  const status = field(loan, 'status');
  if (status !== undefined && status !== null) {
    return String(status).toLowerCase() === 'active' && !returned;
  }
  return !returned;
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

async function borrowBook(userId, bookId) {
  return withTransaction(async (client) => {
    const book = await lockBook(client, bookId);
    if (!book) throw httpError(404, 'Book not found');

    const existing = await findActiveLoanForUserAndBook(client, userId, bookId);
    if (existing) throw httpError(409, 'You already have this book');

    if (String(field(book, 'status')).toLowerCase() !== 'available') {
      throw httpError(400, 'Book not available');
    }

    await setBookStatus(client, bookId, 'borrowed');

    const due = new Date(Date.now() + resolveLoanDays() * 24 * 60 * 60 * 1000);
    const loan = await insertLoan(client, userId, bookId, due);

    const loanId = field(loan, 'loan_id', 'loanId', 'id');
    const dueRaw = field(loan, 'due_date', 'dueDate');
    const dueDate = dueRaw ? new Date(dueRaw).toISOString() : due.toISOString();

    await writeAudit(client, userId, 'BORROW', { bookId, loanId, dueDate });

    return { loanId, dueDate };
  });
}

async function returnBook(userId, loanId) {
  return withTransaction(async (client) => {
    const loan = await lockLoan(client, loanId);
    if (!loan) throw httpError(404, 'Loan not found');

    if (String(field(loan, 'user_id', 'userId')) !== String(userId)) {
      throw httpError(403, 'This loan does not belong to you');
    }
    if (!isActive(loan)) throw httpError(400, 'Loan is not active');

    const bookId = field(loan, 'book_id', 'bookId');

    // Lock the book row before changing its status.
    await lockBook(client, bookId);
    await markLoanReturned(client, loanId);
    await setBookStatus(client, bookId, 'available');
    await writeAudit(client, userId, 'RETURN', { bookId, loanId });

    return { success: true };
  });
}

async function getMyLoans(userId) {
  const fn = pickFn(loanRepository, ['findByUser', 'findByUserId', 'getByUser', 'findActiveByUser']);
  if (fn) return fn(userId);
  const { rows } = await poolQuery(
    `SELECT l.loan_id AS "loanId", l.book_id AS "bookId", b.title, b.author, b.isbn,
            l.borrow_date AS "borrowDate", l.due_date AS "dueDate", l.return_date AS "returnDate"
       FROM loans l
       JOIN books b ON b.book_id = l.book_id
      WHERE l.user_id = $1
      ORDER BY l.borrow_date DESC`,
    [userId]
  );
  return rows;
}

async function getAllBorrowed() {
  const fn = pickFn(loanRepository, ['findAllActive', 'findActive', 'getAllActive', 'getAllBorrowed']);
  if (fn) return fn();
  const { rows } = await poolQuery(
    `SELECT l.loan_id AS "loanId", l.book_id AS "bookId", b.title, b.author, b.isbn,
            l.user_id AS "userId", u.full_name AS "userName", u.email AS "userEmail",
            l.borrow_date AS "borrowDate", l.due_date AS "dueDate"
       FROM loans l
       JOIN books b ON b.book_id = l.book_id
       JOIN users u ON u.user_id = l.user_id
      WHERE l.return_date IS NULL
      ORDER BY l.due_date ASC`
  );
  return rows;
}

module.exports = { borrowBook, returnBook, getMyLoans, getAllBorrowed };