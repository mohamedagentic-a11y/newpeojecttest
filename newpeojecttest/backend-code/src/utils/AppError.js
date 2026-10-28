'use strict';

/**
 * Application-level error carrying an HTTP status code.
 * The error-handling middleware is expected to translate it into:
 *   { "error": { "code": <statusCode>, "message": <message> } }
 */
class AppError extends Error {
  /**
   * @param {number} statusCode HTTP status code (4xx/5xx)
   * @param {string} message Human-readable error message
   * @param {object} [details] Optional extra details (e.g. validation issues)
   */
  constructor(statusCode, message, details) {
    super(message || 'Internal Server Error');
    this.name = 'AppError';
    this.statusCode = Number.isInteger(statusCode) ? statusCode : 500;
    this.isOperational = true;
    if (details !== undefined) {
      this.details = details;
    }
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    const body = { code: this.statusCode, message: this.message };
    if (this.details !== undefined) {
      body.details = this.details;
    }
    return { error: body };
  }

  static badRequest(message = 'Bad Request', details) {
    return new AppError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(403, message);
  }

  static notFound(message = 'Not Found') {
    return new AppError(404, message);
  }

  static conflict(message = 'Conflict') {
    return new AppError(409, message);
  }

  static internal(message = 'Internal Server Error') {
    return new AppError(500, message);
  }
}

module.exports = { AppError };