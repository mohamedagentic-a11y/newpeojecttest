'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routesModule = require('./routes/index');
const errorModule = require('./middleware/errorHandler');
const envModule = require('./config/env');

const apiRouter = routesModule.apiRouter || routesModule.router;
const { notFoundHandler, errorHandler } = errorModule;
const env = envModule.env || envModule.config || {};

if (typeof apiRouter !== 'function') {
  throw new Error('app.js: routes/index.js did not export an Express router (expected named export "apiRouter").');
}
if (typeof notFoundHandler !== 'function' || typeof errorHandler !== 'function') {
  throw new Error('app.js: middleware/errorHandler.js must export "notFoundHandler" and "errorHandler".');
}

const nodeEnv = env.nodeEnv || env.NODE_ENV || process.env.NODE_ENV || 'development';
const corsOriginSetting = env.corsOrigin || env.CORS_ORIGIN || process.env.CORS_ORIGIN;

function buildCorsOptions() {
  if (!corsOriginSetting || corsOriginSetting === '*') {
    return {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };
  }
  const origins = String(corsOriginSetting)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return {
    origin: origins.length === 1 ? origins[0] : origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}

const app = express();

app.disable('x-powered-by');

app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(nodeEnv === 'production' ? 'combined' : 'dev'));

app.use('/api/v1', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };