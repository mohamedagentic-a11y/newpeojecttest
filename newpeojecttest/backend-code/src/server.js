'use strict';

const { app } = require('./app');
const { initDatabase } = require('./db/init');
const { config } = require('./config/env');

let server = null;

async function start() {
  try {
    await initDatabase();
    console.log('[server] Database initialised');
  } catch (err) {
    console.error('[server] Failed to initialise database:', err);
    process.exit(1);
  }

  const port = Number(config.port);
  if (!Number.isInteger(port) || port <= 0) {
    console.error(`[server] Invalid port configuration: ${config.port}`);
    process.exit(1);
  }

  server = app.listen(port, () => {
    console.log(`[server] API listening on port ${port} (base path /api/v1)`);
  });

  server.on('error', (err) => {
    console.error('[server] HTTP server error:', err);
    process.exit(1);
  });
}

function shutdown(signal) {
  console.log(`[server] Received ${signal}, shutting down`);
  if (!server) {
    process.exit(0);
    return;
  }
  server.close((err) => {
    if (err) {
      console.error('[server] Error while closing HTTP server:', err);
      process.exit(1);
      return;
    }
    console.log('[server] HTTP server closed');
    process.exit(0);
  });
  // Force exit if connections do not drain in time.
  setTimeout(() => {
    console.error('[server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception:', err);
  process.exit(1);
});

start();