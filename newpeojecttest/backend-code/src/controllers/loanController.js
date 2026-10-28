/**
 * Loan controller.
 *
 * Thin HTTP layer over loanService. It validates the request body with zod,
 * resolves the authenticated user's id from req.user (set by the auth
 * middleware), calls the service, and responds with { data }. Every failure is
 * passed to next() so the centralized error middleware formats it as
 * { error: { code, message } }.
 */
const { z } = require('zod');
const loanService = require('../services/loanService');

const borrowSchema = z.object({
  bookId: z.union([z.string().trim().min(1), z.number()]).transform(String),
});

const returnSchema = z.object({
  loanId: z.union([z.string().trim().min(1), z.number()]).transform(String),
});

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  err.expose = true;
  return err;
}

/**
 * Resolve a service function by its name. Several names are accepted so that
 * this controller works with the names loanService actually exports. If none of
 * them exists, an error is thrown and reported as a server error.
 */
function resolveServiceFn(candidates) {
  for (const name of candidates) {
    if (typeof loanService[name] === 'function') {
      return loanService[name];
    }
  }
  throw httpError(500, `Loan service does not provide any of: ${candidates.join(', ')}`);
}

function getUserId(req) {
  const user = req.user;
  if (!user) {
    throw httpError(401, 'Authentication required.');
  }
  const id = user.id ?? user.userId ?? user.user_id ?? user.sub;
  if (id === undefined || id === null || id === '') {
    throw httpError(401, 'Authenticated user has no id.');
  }
  return id;
}

function parseBody(schema, body) {
  const result = schema.safeParse(body || {});
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    throw httpError(400, message || 'Invalid request body.');
  }
  return result.data;
}

async function borrow(req, res, next) {
  try {
    const userId = getUserId(req);
    const { bookId } = parseBody(borrowSchema, req.body);
    const fn = resolveServiceFn(['borrowBook', 'borrow', 'createLoan']);
    const result = await fn(userId, bookId);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function returnLoan(req, res, next) {
  try {
    const userId = getUserId(req);
    const { loanId } = parseBody(returnSchema, req.body);
    const fn = resolveServiceFn(['returnBook', 'returnLoan', 'returnLoanById']);
    const result = await fn(userId, loanId);
    res.status(200).json({ data: result === undefined ? { success: true } : result });
  } catch (err) {
    next(err);
  }
}

async function myLoans(req, res, next) {
  try {
    const userId = getUserId(req);
    const fn = resolveServiceFn([
      'getMyLoans',
      'myLoans',
      'getUserLoans',
      'getLoansByUser',
      'listUserLoans',
      'listMyLoans',
    ]);
    const result = await fn(userId);
    res.status(200).json({ data: result || [] });
  } catch (err) {
    next(err);
  }
}

async function allBorrowed(req, res, next) {
  try {
    const fn = resolveServiceFn([
      'getAllBorrowed',
      'allBorrowed',
      'listAllBorrowed',
      'getAllActiveLoans',
      'listActiveLoans',
      'listBorrowed',
    ]);
    const result = await fn();
    res.status(200).json({ data: result || [] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  borrow,
  returnLoan,
  myLoans,
  allBorrowed,
};