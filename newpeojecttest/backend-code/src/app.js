const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { apiRouter } = require('./routes/index');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { config } = require('./config/env');

const app = express();

app.disable('x-powered-by');

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api/v1', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app };