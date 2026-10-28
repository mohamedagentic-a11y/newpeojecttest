const { pool } = require('../db/pool');

/**
 * Loan repository: raw SQL access to the loans table.
 *
 * Transactional functions take a `client` (a checked-out pg PoolClient inside
 * a BEGIN/COMMIT block managed by the service layer). Read-only listing
 * functions use the shared pool directly.
 *
 * Schema (per LLD):
 *   loans(loan_id UUID PK, user_id FK -> users, book_id FK -> books,
 *         borrow_date TIMESTAMP, due_date TIMESTAMP, return_date TIMESTAMP NULL)
 * A loan is "active" while return_date IS NULL.
 */

function mapLoan(row) {
  if (!row) return null;
  return {
    id: row.loan_id,
    userId: row.user_id,
    bookId: row.book_id,
    borrowDate: row.borrow_date,
    dueDate: row.due_date,
    returnDate: row.return_date,
  };
}

const LOAN_COLUMNS = 'l.loan_id, l.user_id, l.book_id, l.borrow_date, l.due_date, l.return_date';

const loanRepository = {
  /**
   * Insert a new loan inside an existing transaction.
   * @param {import('pg').PoolClient} client
   * @param {{ userId: string, bookId: string, dueDate: Date|string }} params
   */
  async create(client, { userId, bookId, dueDate }) {
    const { rows } = await client.query(
      `INSERT INTO loans (user_id, book_id, borrow_date, due_date)
       VALUES ($1, $2, NOW(), $3)
       RETURNING loan_id, user_id, book_id, borrow_date, due_date, return_date`,
      [userId, bookId, dueDate]
    );
    return mapLoan(rows[0]);
  },

  /**
   * Find an active (not yet returned) loan for a given user and book.
   * @param {import('pg').PoolClient} client
   * @param {string} userId
   * @param {string} bookId
   */
  async findActiveByUserAndBook(client, userId, bookId) {
    const { rows } = await client.query(
      `SELECT ${LOAN_COLUMNS}
         FROM loans l
        WHERE l.user_id = $1
          AND l.book_id = $2
          AND l.return_date IS NULL
        LIMIT 1`,
      [userId, bookId]
    );
    return mapLoan(rows[0]);
  },

  /**
   * Lock a loan row for update within a transaction.
   * @param {import('pg').PoolClient} client
   * @param {string} loanId
   */
  async findByIdForUpdate(client, loanId) {
    const { rows } = await client.query(
      `SELECT ${LOAN_COLUMNS}
         FROM loans l
        WHERE l.loan_id = $1
        FOR UPDATE`,
      [loanId]
    );
    return mapLoan(rows[0]);
  },

  /**
   * Mark a loan as returned. Only affects loans that are still active.
   * @param {import('pg').PoolClient} client
   * @param {string} loanId
   * @returns {Promise<object|null>} the updated loan, or null if none was active
   */
  async markReturned(client, loanId) {
    const { rows } = await client.query(
      `UPDATE loans
          SET return_date = NOW()
        WHERE loan_id = $1
          AND return_date IS NULL
        RETURNING loan_id, user_id, book_id, borrow_date, due_date, return_date`,
      [loanId]
    );
    return mapLoan(rows[0]);
  },

  /**
   * List a user's active loans joined with book details.
   * @param {string} userId
   */
  async listActiveByUser(userId) {
    const { rows } = await pool.query(
      `SELECT ${LOAN_COLUMNS},
              b.title, b.author, b.isbn, b.status AS book_status
         FROM loans l
         JOIN books b ON b.book_id = l.book_id
        WHERE l.user_id = $1
          AND l.return_date IS NULL
        ORDER BY l.due_date ASC`,
      [userId]
    );
    return rows.map((row) => ({
      ...mapLoan(row),
      book: {
        id: row.book_id,
        title: row.title,
        author: row.author,
        isbn: row.isbn,
        status: row.book_status,
      },
    }));
  },

  /**
   * List all active loans joined with book and user details (librarian view).
   */
  async listAllActive() {
    const { rows } = await pool.query(
      `SELECT ${LOAN_COLUMNS},
              b.title, b.author, b.isbn, b.status AS book_status,
              u.full_name, u.email
         FROM loans l
         JOIN books b ON b.book_id = l.book_id
         JOIN users u ON u.user_id = l.user_id
        WHERE l.return_date IS NULL
        ORDER BY l.due_date ASC`
    );
    return rows.map((row) => ({
      ...mapLoan(row),
      book: {
        id: row.book_id,
        title: row.title,
        author: row.author,
        isbn: row.isbn,
        status: row.book_status,
      },
      user: {
        id: row.user_id,
        name: row.full_name,
        email: row.email,
      },
    }));
  },
};

module.exports = { loanRepository };