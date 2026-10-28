'use strict';

/**
 * Loan service: borrowing and returning books.
 *
 * Borrowing runs inside a single database transaction. The book row is locked
 * with SELECT ... FOR UPDATE, so two members cannot borrow the same copy at once.
 */

const poolModule = require('../db/pool');
const { loanRepository } = require('../repositories/loanRepository');
const { bookRepository } = require('../repositories/bookRepository');
const { env } = require('../config/env');
const { AppError } = require('../utils/AppError');

const DEFAULT_LOAN_PERIOD_DAYS = 14;

function getPool() {
  return poolModule.pool || poolModule.default || null;
}

/**
 * Run fn(client) inside a transaction. Uses the pool module's withTransaction
 * when it provides one, otherwise BEGIN/COMMIT/ROLLBACK on a pooled client.
 */
async function runInTransaction(fn) {
  if (typeof poolModule.withTransaction === 'function') {
    return poolModule.withTransaction(fn);
  }
  const pool = getPool();
  if (!pool) {
    throw new Error('Database pool is not available');
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
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Prefer a repository method when one exists under any of the given names.
 * Otherwise run the supplied SQL fallback.
 */
async function callRepo(repo, names, args, fallback) {
  if (repo) {
    for (const name of names) {
      if (typeof repo[name] === 'function') {
        return repo[name](...args);
      }
    }
  }
  return fallback();
}

function getLoanPeriodDays() {
  const raw =
    (env && (env.loanPeriodDays ?? env.LOAN_PERIOD_DAYS)) ??
    process.env.LOAN_PERIOD_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LOAN_PERIOD_DAYS;
}

function mapLoan(row) {
  if (!row) return null;
  return {
    id: row.loan_id ?? row.id,
    loanId: row.loan_id ?? row.id,
    userId: row.user_id ?? row.userId,
    bookId: row.book_id ?? row.bookId,
    borrowDate: row.borrow_date ?? row.borrowDate,
    dueDate: row.due_date ?? row.dueDate,
    returnDate: row.return_date ?? row.returnDate ?? null,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    memberName: row.full_name ?? row.memberName,
    memberEmail: row.email ?? row.memberEmail,
  };
}

const loanService = {
  /**
   * Borrow a book for a member.
   * @returns {Promise<{loanId: string, dueDate: string}>}
   */
  async borrow(userId, bookId) {
    if (!userId) throw new AppError('Authentication required', 401);
    if (!bookId) throw new AppError('bookId is required', 400);

    const loanPeriodDays = getLoanPeriodDays();

    return runInTransaction(async (client) => {
      // Lock the book row for the duration of the transaction.
      const bookRes = await client.query(
        'SELECT book_id, status FROM books WHERE book_id = $1 FOR UPDATE',
        [bookId]
      );
      const book = bookRes.rows[0];
      if (!book) {
        throw new AppError('Book not found', 404);
      }

      // Reject a duplicate active loan by the same member.
      const dupRes = await client.query(
        `SELECT loan_id FROM loans
          WHERE user_id = $1 AND book_id = $2 AND return_date IS NULL
          LIMIT 1`,
        [userId, bookId]
      );
      if (dupRes.rows.length > 0) {
        throw new AppError('You already have this book', 409);
      }

      if (book.status !== 'available') {
        throw new AppError('Book is not available', 400);
      }

      await client.query(
        "UPDATE books SET status = 'borrowed' WHERE book_id = $1",
        [bookId]
      );

      const dueDate = new Date(Date.now() + loanPeriodDays * 24 * 60 * 60 * 1000);

      const insertRes = await client.query(
        `INSERT INTO loans (user_id, book_id, borrow_date, due_date)
         VALUES ($1, $2, NOW(), $3)
         RETURNING loan_id, due_date`,
        [userId, bookId, dueDate]
      );
      const loan = insertRes.rows[0];
      const due = loan.due_date instanceof Date ? loan.due_date : new Date(loan.due_date);

      return { loanId: loan.loan_id, dueDate: due.toISOString() };
    });
  },

  /**
   * Return a borrowed book. Only the member who holds the loan may return it.
   * @returns {Promise<{success: true}>}
   */
  async returnBook(userId, loanId) {
    if (!userId) throw new AppError('Authentication required', 401);
    if (!loanId) throw new AppError('loanId is required', 400);

    return runInTransaction(async (client) => {
      const loanRes = await client.query(
        `SELECT loan_id, user_id, book_id, return_date
           FROM loans WHERE loan_id = $1 FOR UPDATE`,
        [loanId]
      );
      const loan = loanRes.rows[0];
      if (!loan) {
        throw new AppError('Loan not found', 404);
      }
      if (String(loan.user_id) !== String(userId)) {
        throw new AppError('You can only return your own loans', 403);
      }
      if (loan.return_date) {
        throw new AppError('This loan has already been returned', 400);
      }

      // Lock the book row before changing its status.
      await client.query('SELECT book_id FROM books WHERE book_id = $1 FOR UPDATE', [
        loan.book_id,
      ]);

      await client.query('UPDATE loans SET return_date = NOW() WHERE loan_id = $1', [loanId]);
      await client.query("UPDATE books SET status = 'available' WHERE book_id = $1", [
        loan.book_id,
      ]);

      return { success: true };
    });
  },

  /**
   * All loans for a member, active ones first.
   */
  async myLoans(userId) {
    if (!userId) throw new AppError('Authentication required', 401);
    const rows = await callRepo(
      loanRepository,
      ['findByUserId', 'findByUser', 'listByUser'],
      [userId],
      async () => {
        const pool = getPool();
        if (!pool) throw new Error('Database pool is not available');
        const res = await pool.query(
          `SELECT l.loan_id, l.user_id, l.book_id, l.borrow_date, l.due_date, l.return_date,
                  b.title, b.author, b.isbn
             FROM loans l
             JOIN books b ON b.book_id = l.book_id
            WHERE l.user_id = $1
            ORDER BY (l.return_date IS NULL) DESC, l.borrow_date DESC`,
          [userId]
        );
        return res.rows;
      }
    );
    return (rows || []).map(mapLoan);
  },

  /**
   * All active (unreturned) loans across members, for librarians.
   */
  async allActiveLoans() {
    const rows = await callRepo(
      loanRepository,
      ['findAllActive', 'findActive', 'listActive'],
      [],
      async () => {
        const pool = getPool();
        if (!pool) throw new Error('Database pool is not available');
        const res = await pool.query(
          `SELECT l.loan_id, l.user_id, l.book_id, l.borrow_date, l.due_date, l.return_date,
                  b.title, b.author, b.isbn, u.full_name, u.email
             FROM loans l
             JOIN books b ON b.book_id = l.book_id
             JOIN users u ON u.user_id = l.user_id
            WHERE l.return_date IS NULL
            ORDER BY l.due_date ASC`
        );
        return res.rows;
      }
    );
    return (rows || []).map(mapLoan);
  },
};

// Referenced so the repository layer stays wired to this service.
void bookRepository;

module.exports = { loanService };