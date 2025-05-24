class AppError extends Error {
  /**
   * Constructor for AppError.
   * @param {string} message - The error message.
   * @param {number} statusCode - The HTTP status code for this error.
   */
  constructor(message, statusCode) {
    super(message); // Call the parent class (Error) constructor with the message

    this.statusCode = statusCode; // Custom property for HTTP status code
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'; // 'fail' for 4xx, 'error' for 5xx
    this.isOperational = true; // Differentiates operational errors from programming errors

    // Capture the stack trace, excluding the constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { AppError };