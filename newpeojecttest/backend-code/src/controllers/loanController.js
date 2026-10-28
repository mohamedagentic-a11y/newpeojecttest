'use strict';

const { z } = require('zod');
const { loanService } = require('../services/loanService');

/**
 * Loan controller: thin HTTP layer over loanService.
 * All successful responses use the { data } envelope.
 * Errors are forwarded to the Express error handler via next(err).
 */

const borrowSchema = z.object({
  bookId: z.string().trim().min(1, 'bookId is required'),
});

const returnSchema = z.object({
  loanId: z.string().trim().min(1, 'loanId is required'),
});

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  return err;
}

/**
 * Resolve a service method by trying a list of candidate names, so the
 * controller binds to whatever name the service layer actually exports.
 */
function serviceMethod(candidates) {
  for (const name of candidates) {
    if (loanService && typeof loanService[name] === 'function') {
      return loanService[name].bind(loanService);
    }
  }
  return null;
}

function requireMethod(candidates) {
  const fn = serviceMethod(candidates);
  if (!fn) {
    throw httpError(500, `Loan service does not implement ${candidates[0]}`);
  }
  return fn;
}

function currentUserId(req) {
  const user = req.user;
  if (!user) return null;
  return user.id || user.userId || user.user_id || user.sub || null;
}

function parseBody(schema, body) {
  const result = schema.safeParse(body || {});
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join('; ') || 'Invalid request body';
    throw httpError(400, message);
  }
  return result.data;
}

const loanController = {
  /**
   * POST /api/v1/loans/borrow
   * Body: { bookId }
   * Response: { data: { loanId, dueDate } }
   */
  async borrow(req, res, next) {
    try {
      const userId = currentUserId(req);
      if (!userId) throw httpError(401, 'Authentication required');
      const { bookId } = parseBody(borrowSchema, req.body);
      const borrowFn = requireMethod(['borrow', 'borrowBook', 'createLoan']);
      const result = await borrowFn(userId, bookId);
      return res.status(200).json({ data: result });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * POST /api/v1/loans/return
   * Body: { loanId }
   * Response: { data: { success: true } }
   */
  async returnBook(req, res, next) {
    try {
      const userId = currentUserId(req);
      if (!userId) throw httpError(401, 'Authentication required');
      const { loanId } = parseBody(returnSchema, req.body);
      const returnFn = requireMethod(['returnBook', 'return', 'returnLoan']);
      const result = await returnFn(userId, loanId);
      const data = result && typeof result === 'object' ? result : { success: true };
      return res.status(200).json({ data });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/v1/loans/my-loans
   * Response: { data: Loan[] }
   */
  async myLoans(req, res, next) {
    try {
      const userId = currentUserId(req);
      if (!userId) throw httpError(401, 'Authentication required');
      const fn = requireMethod(['myLoans', 'getMyLoans', 'listUserLoans', 'getLoansForUser']);
      const loans = await fn(userId);
      return res.status(200).json({ data: Array.isArray(loans) ? loans : loans || [] });
    } catch (err) {
      return next(err);
    }
  },

  /**
   * GET /api/v1/loans/active  (librarian)
   * Response: { data: Loan[] }
   */
  async activeLoans(req, res, next) {
    try {
      const fn = requireMethod(['activeLoans', 'getActiveLoans', 'listActiveLoans']);
      const loans = await fn();
      return res.status(200).json({ data: Array.isArray(loans) ? loans : loans || [] });
    } catch (err) {
      return next(err);
    }
  },
};

// Alias so routes may reference either name.
loanController.return = loanController.returnBook;

module.exports = { loanController };