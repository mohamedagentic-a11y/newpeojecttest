'use strict';

/**
 * Loan data access layer.
 *
 * Functions that take a `client` argument are designed to run inside a
 * transaction opened by the service layer (BEGIN / COMMIT with
 * SELECT ... FOR UPDATE on the book row). The list functions run directly on
 * the shared pool.
 *
 * A loan is "active" while its return_date is NULL.
 */

const { pool } = require('../db/pool');

const LOAN_COLUMNS = `
  l.loan_id     AS "id",
  l.user_id     AS "userId",
  l.book_id     AS "bookId",
  l.borrow_date AS "borrowDate",
  l.due_date    AS "dueDate",
  l.return_date AS "returnDate"
`;

/**
 * Insert a new loan row.
 * @param {import('pg').PoolClient} client
 * @param {{userId: string, bookId: string, dueDate: Date|string}} params
 * @returns {Promise<{id: string, userId: string, bookId: string, borrowDate: Date, dueDate: Date, returnDate: Date|null}>}
 */
async function insertLoan(client, { userId, bookId, dueDate }) {
  const { rows } = await client.query(
    `INSERT INTO loans (user_id, book_id, borrow_date, due_date)
     VALUES ($1, $2, NOW(), $3)
     RETURNING
       loan_id     AS "id",
       user_id     AS "userId",
       book_id     AS "bookId",
       borrow_date AS "borrowDate",
       due_date    AS "dueDate",
       return_date AS "returnDate"`,
    [userId, bookId, dueDate]
  );
  return rows[0];
}

/**
 * Find an active (unreturned) loan for a given user and book.
 * @param {import('pg').PoolClient} client
 * @param {string} userId
 * @param {string} bookId
 * @returns {Promise<object|null>}
 */
async function findActiveByUserAndBook(client, userId, bookId) {
  const { rows } = await client.query(
    `SELECT ${LOAN_COLUMNS}
       FROM loans l
      WHERE l.user_id = $1
        AND l.book_id = $2
        AND l.return_date IS NULL
      LIMIT 1`,
    [userId, bookId]
  );
  return rows[0] || null;
}

/**
 * Find an active loan by id, locking the row for the current transaction.
 * @param {import('pg').PoolClient} client
 * @param {string} loanId
 * @returns {Promise<object|null>}
 */
async function findActiveById(client, loanId) {
  const { rows } = await client.query(
    `SELECT ${LOAN_COLUMNS}
       FROM loans l
      WHERE l.loan_id = $1
        AND l.return_date IS NULL
      FOR UPDATE`,
    [loanId]
  );
  return rows[0] || null;
}

/**
 * Mark a loan as returned. Only affects loans still active.
 * @param {import('pg').PoolClient} client
 * @param {string} loanId
 * @returns {Promise<object|null>} the updated loan, or null if no active loan matched
 */
async function markReturned(client, loanId) {
  const { rows } = await client.query(
    `UPDATE loans
        SET return_date = NOW()
      WHERE loan_id = $1
        AND return_date IS NULL
      RETURNING
        loan_id     AS "id",
        user_id     AS "userId",
        book_id     AS "bookId",
        borrow_date AS "borrowDate",
        due_date    AS "dueDate",
        return_date AS "returnDate"`,
    [loanId]
  );
  return rows[0] || null;
}

/**
 * List a user's active loans, joined with book title/author.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function listActiveByUser(userId) {
  const { rows } = await pool.query(
    `SELECT ${LOAN_COLUMNS},
            b.title  AS "title",
            b.author AS "author",
            b.isbn   AS "isbn"
       FROM loans l
       JOIN books b ON b.book_id = l.book_id
      WHERE l.user_id = $1
        AND l.return_date IS NULL
      ORDER BY l.due_date ASC`,
    [userId]
  );
  return rows;
}

/**
 * List all active loans (librarian view), joined with book and user name.
 * @returns {Promise<object[]>}
 */
async function listAllActive() {
  const { rows } = await pool.query(
    `SELECT ${LOAN_COLUMNS},
            b.title     AS "title",
            b.author    AS "author",
            b.isbn      AS "isbn",
            u.full_name AS "userName",
            u.email     AS "userEmail"
       FROM loans l
       JOIN books b ON b.book_id = l.book_id
       JOIN users u ON u.user_id = l.user_id
      WHERE l.return_date IS NULL
      ORDER BY l.due_date ASC`
  );
  return rows;
}

module.exports = {
  insertLoan,
  findActiveByUserAndBook,
  findActiveById,
  markReturned,
  listActiveByUser,
  listAllActive,
};