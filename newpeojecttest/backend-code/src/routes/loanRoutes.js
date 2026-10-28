'use strict';

const express = require('express');

const loanControllerModule = require('../controllers/loanController');
const authModule = require('../middleware/auth');
const validateModule = require('../middleware/validate');
const schemasModule = require('../validators/schemas');

/**
 * Returns the first function found under any of the given names on any of the
 * given sources.
 */
function pickFn(sources, names) {
  for (const src of sources) {
    if (!src) continue;
    for (const name of names) {
      if (typeof src[name] === 'function') return src[name];
    }
  }
  return null;
}

/**
 * Returns the first defined value found under any of the given names on any of
 * the given sources.
 */
function pickValue(sources, names) {
  for (const src of sources) {
    if (!src) continue;
    for (const name of names) {
      if (src[name] !== undefined && src[name] !== null) return src[name];
    }
  }
  return null;
}

function required(fn, description) {
  if (typeof fn !== 'function') {
    throw new Error(`loanRoutes: required ${description} is not exported by its module`);
  }
  return fn;
}

// ---- Controller handlers ---------------------------------------------------
const controller = loanControllerModule.loanController || loanControllerModule;
const controllerSources = [controller, loanControllerModule];

const borrowHandler = required(
  pickFn(controllerSources, ['borrow', 'borrowBook', 'createLoan']),
  'loan controller borrow handler'
);
const returnHandler = required(
  pickFn(controllerSources, ['returnBook', 'return', 'returnLoan']),
  'loan controller return handler'
);
const myLoansHandler = required(
  pickFn(controllerSources, ['myLoans', 'getMyLoans', 'listMyLoans']),
  'loan controller my-loans handler'
);
const activeLoansHandler = required(
  pickFn(controllerSources, ['activeLoans', 'getActiveLoans', 'listActiveLoans', 'active']),
  'loan controller active-loans handler'
);

// ---- Auth middleware -------------------------------------------------------
const authSource = authModule.auth && typeof authModule.auth === 'object' ? authModule.auth : null;
const authSources = [authSource, authModule];

const authenticate = required(
  pickFn(authSources, ['authenticate', 'requireAuth', 'authenticateToken', 'verifyToken', 'auth']),
  'authentication middleware'
);

const roleFactory = pickFn(authSources, ['requireRole', 'authorize', 'authorizeRoles', 'requireRoles']);

/**
 * Builds a role guard. Uses the auth module's factory where present; otherwise
 * enforces the role directly from req.user set by the authentication middleware.
 */
function requireRole(role) {
  if (roleFactory) return roleFactory(role);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 401, message: 'Authentication required.' } });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: { code: 403, message: 'Forbidden: insufficient role.' } });
    }
    return next();
  };
}

// ---- Validation ------------------------------------------------------------
const validate = pickFn([validateModule], ['validate', 'validateBody', 'validateRequest']);

const schemaSources = [schemasModule.schemas, schemasModule];
const borrowSchema = pickValue(schemaSources, ['borrowSchema', 'borrowBookSchema', 'borrowLoanSchema', 'loanBorrowSchema']);
const returnSchema = pickValue(schemaSources, ['returnSchema', 'returnBookSchema', 'returnLoanSchema', 'loanReturnSchema']);

function validateWith(schema) {
  if (validate && schema) return validate(schema);
  return (req, res, next) => next();
}

// ---- Router ----------------------------------------------------------------
const loanRoutes = express.Router();

// All loan endpoints require an authenticated user.
loanRoutes.use(authenticate);

// Members
loanRoutes.post('/borrow', requireRole('member'), validateWith(borrowSchema), borrowHandler);
loanRoutes.post('/return', requireRole('member'), validateWith(returnSchema), returnHandler);
loanRoutes.get('/my-loans', requireRole('member'), myLoansHandler);

// Librarians
loanRoutes.get('/active', requireRole('librarian'), activeLoansHandler);

module.exports = { loanRoutes };