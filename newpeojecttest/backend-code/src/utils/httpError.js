'use strict';

/**
 * HttpError — an Error that carries an HTTP status and an error code.
 * The centralized error middleware turns it into:
 *   { error: { code, message } }
 * Per the API specification, `code` defaults to the numeric HTTP status.
 */
class HttpError extends Error {
  /**
   * @param {number} status  HTTP status code (4xx/5xx)
   * @param {string} message Human-readable message
   * @param {object} [options]
   * @param {number|string} [options.code]    Error code for the response body (defaults to status)
   * @param {*}             [options.details] Optional extra details (e.g. validation issues)
   */
  constructor(status, message, options = {}) {
    super(message || 'Error');
    this.name = 'HttpError';
    this.status = Number.isInteger(status) ? status : 500;
    this.statusCode = this.status;
    this.code = options.code !== undefined ? options.code : this.status;
    if (options.details !== undefined) {
      this.details = options.details;
    }
    this.expose = this.status < 500;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}

function badRequest(message = 'Bad Request', options) {
  return new HttpError(400, message, options);
}

function unauthorized(message = 'Unauthorized', options) {
  return new HttpError(401, message, options);
}

function forbidden(message = 'Forbidden', options) {
  return new HttpError(403, message, options);
}

function notFound(message = 'Not Found', options) {
  return new HttpError(404, message, options);
}

function conflict(message = 'Conflict', options) {
  return new HttpError(409, message, options);
}

module.exports = {
  HttpError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
};