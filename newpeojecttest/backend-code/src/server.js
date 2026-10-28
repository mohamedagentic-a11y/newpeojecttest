'use strict';

const { app } = require('./app');
const { initDatabase } = require('./db/init');
const { config } = require('./config/env');

async function start() {
  try {
    await initDatabase();
  } catch (err) {
    console.error('[server] Database initialization failed:', err && err.message ? err.message : err);
    process.exit(1);
  }

  const port = config && config.port;
  if (port === undefined || port === null || port === '') {
    console.error('[server] No port configured (config.port is missing). Refusing to start.');
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`[server] Library API listening on port ${port} (routes under /api/v1)`);
  });

  server.on('error', (err) => {
    console.error('[server] HTTP server error:', err && err.message ? err.message : err);
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.log(`[server] Received ${signal}, shutting down...`);
    server.close(() => {
      console.log('[server] HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});

start();