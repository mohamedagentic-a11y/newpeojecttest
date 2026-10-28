'use strict';

const express = require('express');

const bookController = require('../controllers/bookController');
const { validate } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  bookQuerySchema,
  bookCreateSchema,
  bookUpdateSchema,
} = require('../validators/schemas');

/**
 * Resolve a controller handler by trying the conventional names in order.
 * Fails loudly at startup if none exists, rather than mounting a route that
 * would crash (or silently do nothing) on its first request.
 */
function resolveHandler(candidates) {
  for (const name of candidates) {
    if (typeof bookController[name] === 'function') {
      return bookController[name];
    }
  }
  throw new Error(
    `bookRoutes: bookController exports none of [${candidates.join(', ')}]`
  );
}

const listBooks = resolveHandler(['listBooks', 'getBooks', 'searchBooks', 'list', 'search']);
const createBook = resolveHandler(['createBook', 'addBook', 'create']);
const updateBook = resolveHandler(['updateBook', 'editBook', 'update']);
const deleteBook = resolveHandler(['deleteBook', 'removeBook', 'remove', 'destroy']);

const bookRouter = express.Router();

// Every book route requires a valid JWT.
bookRouter.use(authenticate);

// GET /api/v1/books — search the catalogue (any signed-in role).
bookRouter.get('/', validate(bookQuerySchema, 'query'), listBooks);

// POST /api/v1/books — add a book (librarian only).
bookRouter.post(
  '/',
  requireRole('librarian'),
  validate(bookCreateSchema, 'body'),
  createBook
);

// PUT /api/v1/books/:id — update a book (librarian only).
bookRouter.put(
  '/:id',
  requireRole('librarian'),
  validate(bookUpdateSchema, 'body'),
  updateBook
);

// DELETE /api/v1/books/:id — remove a book (librarian only).
bookRouter.delete('/:id', requireRole('librarian'), deleteBook);

module.exports = { bookRouter };