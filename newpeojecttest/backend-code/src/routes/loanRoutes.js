'use strict';

/**
 * Loan routes, mounted by the application under /api/v1/loans.
 *
 *   POST /borrow    member     body validated by borrowSchema  { bookId }
 *   POST /return    member     body validated by returnSchema  { loanId }
 *   GET  /my-loans  member     the signed-in member's loans
 *   GET  /active    librarian  every book currently borrowed
 *
 * Every route runs behind `authenticate`, which verifies the Bearer JWT and
 * sets req.user. `requireRole` then enforces the role for each route.
 * Errors from the handlers go to the centralized error middleware through
 * next(err).
 */

const express = require('express');

const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { borrowSchema, returnSchema } = require('../validators/schemas');
const loanControllerModule = require('../controllers/loanController');

// The controller module may export its handlers directly, or group them
// under a `loanController` object. Accept either shape.
const loanController =
  loanControllerModule && loanControllerModule.loanController
    ? loanControllerModule.loanController
    : loanControllerModule;

/**
 * Returns the first handler that exists under one of the candidate names.
 * Throws at startup when none exists, so that a missing handler shows up
 * immediately rather than as a silent 404 at runtime.
 */
function resolveHandler(candidates, label) {
  for (const name of candidates) {
    if (typeof loanController[name] === 'function') {
      return loanController[name];
    }
  }
  throw new Error(
    `loanRoutes: loanController does not export a handler for ${label} ` +
      `(looked for: ${candidates.join(', ')})`
  );
}

/**
 * Wraps a handler so that a rejected promise is passed to next(), and so
 * reaches the centralized error middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
  try {
    const result = fn(req, res, next);
    if (result && typeof result.then === 'function') {
      result.catch(next);
    }
  } catch (err) {
    next(err);
  }
};

const borrowHandler = resolveHandler(
  ['borrowBook', 'borrow', 'createLoan'],
  'POST /borrow'
);
const returnHandler = resolveHandler(
  ['returnBook', 'returnLoan', 'return'],
  'POST /return'
);
const myLoansHandler = resolveHandler(
  ['getMyLoans', 'myLoans', 'listMyLoans'],
  'GET /my-loans'
);
const activeLoansHandler = resolveHandler(
  ['getActiveLoans', 'activeLoans', 'listActiveLoans', 'getAllActiveLoans'],
  'GET /active'
);

const loanRouter = express.Router();

// Every loan route requires a valid JWT.
loanRouter.use(authenticate);

loanRouter.post(
  '/borrow',
  requireRole('member'),
  validate(borrowSchema),
  asyncHandler(borrowHandler)
);

loanRouter.post(
  '/return',
  requireRole('member'),
  validate(returnSchema),
  asyncHandler(returnHandler)
);

loanRouter.get('/my-loans', requireRole('member'), asyncHandler(myLoansHandler));

loanRouter.get('/active', requireRole('librarian'), asyncHandler(activeLoansHandler));

module.exports = { loanRouter };