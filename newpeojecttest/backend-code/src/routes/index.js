'use strict';

/**
 * API router mounted at /api/v1 by the application entry point.
 *
 *   /auth   -> authentication routes (POST /auth/login)
 *   /books  -> catalogue routes (GET /books, POST /books)
 *   /loans  -> loan routes (POST /loans/borrow, POST /loans/return)
 *   GET /health -> liveness probe
 *
 * Responses follow the project convention: { data, meta? } on success.
 *
 * Note: the plan's obligation about a Layout component that renders
 * <Layout /> beside an <Outlet /> belongs to the frontend router. This file
 * is the backend Express router, so that obligation does not apply here.
 */

const express = require('express');

const authRoutesModule = require('./authRoutes');
const bookRoutesModule = require('./bookRoutes');
const loanRoutesModule = require('./loanRoutes');

/**
 * Resolve the router a route module exports.
 *
 * Each route module has no default export and exposes its router under a
 * named export. This checks the conventional names first, then falls back to
 * the first exported Express router (a function). It fails loudly when none
 * is found, so a broken module cannot be mounted silently.
 */
function resolveRouter(mod, preferredNames, label) {
  if (!mod || (typeof mod !== 'object' && typeof mod !== 'function')) {
    throw new Error(`Route module "${label}" did not export anything usable.`);
  }

  for (const name of preferredNames) {
    if (typeof mod[name] === 'function') {
      return mod[name];
    }
  }

  const firstFn = Object.keys(mod)
    .map((key) => mod[key])
    .find((value) => typeof value === 'function');

  if (firstFn) {
    return firstFn;
  }

  throw new Error(
    `Route module "${label}" does not export an Express router (expected one of: ${preferredNames.join(', ')}).`
  );
}

const authRouter = resolveRouter(
  authRoutesModule,
  ['authRouter', 'authRoutes', 'router'],
  'authRoutes'
);
const bookRouter = resolveRouter(
  bookRoutesModule,
  ['bookRouter', 'bookRoutes', 'booksRouter', 'router'],
  'bookRoutes'
);
const loanRouter = resolveRouter(
  loanRoutesModule,
  ['loanRouter', 'loanRoutes', 'loansRouter', 'router'],
  'loanRoutes'
);

const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
  res.status(200).json({
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/books', bookRouter);
apiRouter.use('/loans', loanRouter);

module.exports = { apiRouter };