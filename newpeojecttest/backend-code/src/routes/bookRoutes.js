'use strict';

const express = require('express');

const bookControllerModule = require('../controllers/bookController');
const authModule = require('../middleware/auth');
const validateModule = require('../middleware/validate');
const schemasModule = require('../validators/schemas');

/**
 * Return the first function found on `source` under any of `names`.
 * Returns undefined when nothing matches.
 */
function pickFn(source, names) {
  if (!source) return undefined;
  for (const name of names) {
    if (typeof source[name] === 'function') return source[name];
  }
  return undefined;
}

/**
 * Return the first function found under any of `names`.
 * Fails at startup when nothing matches, so a missing handler surfaces
 * immediately instead of as a broken route at request time.
 */
function requireFn(source, names, what) {
  const fn = pickFn(source, names);
  if (!fn) {
    throw new Error(
      `bookRoutes: could not resolve ${what} (looked for: ${names.join(', ')})`
    );
  }
  return fn;
}

/**
 * Return the first zod-like schema found on `source` under any of `names`.
 */
function pickSchema(source, names) {
  if (!source) return undefined;
  for (const name of names) {
    const candidate = source[name];
    if (candidate && typeof candidate.safeParse === 'function') return candidate;
  }
  return undefined;
}

// ---- Controller -----------------------------------------------------------
// The module may export a single controller object, or its handlers directly.
const controller =
  bookControllerModule.bookController ||
  bookControllerModule.BookController ||
  bookControllerModule;

const listBooks = requireFn(
  controller,
  ['listBooks', 'searchBooks', 'getBooks', 'list', 'search', 'getAll', 'index'],
  'book list handler'
);
const createBook = requireFn(
  controller,
  ['createBook', 'addBook', 'create', 'add'],
  'book create handler'
);
const updateBook = requireFn(
  controller,
  ['updateBook', 'editBook', 'update', 'edit'],
  'book update handler'
);
const deleteBook = requireFn(
  controller,
  ['deleteBook', 'removeBook', 'delete', 'remove', 'destroy'],
  'book delete handler'
);

// ---- Auth middleware --------------------------------------------------------
const authenticate = requireFn(
  authModule,
  ['authenticate', 'requireAuth', 'authMiddleware', 'verifyToken', 'authenticateJWT', 'auth'],
  'authentication middleware'
);
const requireRoleFactory = requireFn(
  authModule,
  ['requireRole', 'authorize', 'authorizeRoles', 'requireRoles', 'checkRole', 'hasRole'],
  'role authorization middleware'
);

// The role factory may take its roles as separate arguments or as one array.
// When it returns a middleware we use it; otherwise we pass the array form.
function requireRole(...roles) {
  const mw = requireRoleFactory(...roles);
  if (typeof mw === 'function') return mw;
  return requireRoleFactory(roles);
}

const requireLibrarian = requireRole('librarian');

// ---- Validation -------------------------------------------------------------
const validate = requireFn(
  validateModule,
  ['validate', 'validateBody', 'validateRequest', 'validateSchema'],
  'validation middleware'
);

const schemaContainer =
  schemasModule.schemas || schemasModule.bookSchemas || schemasModule;

const createBookSchema = pickSchema(schemaContainer, [
  'createBookSchema',
  'bookCreateSchema',
  'bookSchema',
  'newBookSchema',
  'createBook',
]);
const updateBookSchema = pickSchema(schemaContainer, [
  'updateBookSchema',
  'bookUpdateSchema',
  'editBookSchema',
  'updateBook',
]);
const bookQuerySchema = pickSchema(schemaContainer, [
  'bookQuerySchema',
  'bookSearchSchema',
  'searchBooksSchema',
  'listBooksSchema',
]);

/** Builds a validation middleware, or a pass-through when no schema exists. */
function validated(schema, label) {
  if (!schema) {
    console.warn(
      `bookRoutes: no zod schema found for ${label}; request validation is left to the controller.`
    );
    return (req, res, next) => next();
  }
  return validate(schema);
}

// Wraps handlers so rejected promises reach Express's error handler.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

// ---- Routes -----------------------------------------------------------------
const bookRoutes = express.Router();

// Every book route requires a signed-in user.
bookRoutes.use(authenticate);

// GET /api/v1/books?q=&author=&status= — any authenticated role
// The search query is validated by the controller when no query schema exists.
// A pass-through is used here instead of validate(), since validate() would
// check the request body, which a GET request does not have.
bookRoutes.get(
  '/',
  bookQuerySchema ? validate(bookQuerySchema) : (req, res, next) => next(),
  asyncHandler(listBooks)
);

// POST /api/v1/books — librarian only
bookRoutes.post(
  '/',
  requireLibrarian,
  validated(createBookSchema, 'book creation'),
  asyncHandler(createBook)
);

// PUT /api/v1/books/:id — librarian only
bookRoutes.put(
  '/:id',
  requireLibrarian,
  validated(updateBookSchema || createBookSchema, 'book update'),
  asyncHandler(updateBook)
);

// DELETE /api/v1/books/:id — librarian only
bookRoutes.delete('/:id', requireLibrarian, asyncHandler(deleteBook));

module.exports = { bookRoutes };