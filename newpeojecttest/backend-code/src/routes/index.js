'use strict';

const express = require('express');

const authRoutesModule = require('./authRoutes');
const bookRoutesModule = require('./bookRoutes');
const loanRoutesModule = require('./loanRoutes');

/**
 * Resolve the router exported by a route module.
 * Each route module exposes its Express router as a named export, not a default.
 * The router is taken from the expected export name if present. Otherwise the
 * first exported Express router (a function with `use`/`handle`) is used.
 * Startup fails loudly if a module provides no router.
 */
function resolveRouter(mod, preferredNames, moduleName) {
  if (!mod) {
    throw new Error(`Route module ${moduleName} did not export anything`);
  }
  for (const name of preferredNames) {
    if (typeof mod[name] === 'function') {
      return mod[name];
    }
  }
  const candidates = Object.values(mod).filter(
    (value) => typeof value === 'function' && typeof value.use === 'function'
  );
  if (candidates.length > 0) {
    return candidates[0];
  }
  throw new Error(`Route module ${moduleName} does not export an Express router`);
}

const authRouter = resolveRouter(
  authRoutesModule,
  ['authRouter', 'authRoutes', 'router'],
  './authRoutes'
);
const bookRouter = resolveRouter(
  bookRoutesModule,
  ['bookRouter', 'bookRoutes', 'booksRouter', 'router'],
  './bookRoutes'
);
const loanRouter = resolveRouter(
  loanRoutesModule,
  ['loanRouter', 'loanRoutes', 'loansRouter', 'router'],
  './loanRoutes'
);

const apiRouter = express.Router();

// Health check (public). Mounted under /api/v1 by the app, giving GET /api/v1/health.
apiRouter.get('/health', (req, res) => {
  res.status(200).json({
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
  });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/books', bookRouter);
apiRouter.use('/loans', loanRouter);

// Unknown API routes return the common error envelope.
apiRouter.use((req, res) => {
  res.status(404).json({
    error: {
      code: 404,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
});

module.exports = { apiRouter };