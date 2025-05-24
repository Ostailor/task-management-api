// This middleware should be the last piece of middleware added to the app
// It's designed to catch errors passed by next(error) or unhandled synchronous errors
// in route handlers if they are not wrapped in try...catch.
// For async errors not caught by try...catch and passed to next(), this will also handle them.

// Centralized error handling middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // ***** START DEBUG LOG - IS ERROR HANDLER REACHED? *****
  console.log('--- ERROR HANDLER REACHED ---');
  if (err) {
    console.log('Error object received in errorHandler:', { 
        message: err.message, 
        name: err.name, 
        isJoi: err.isJoi, // Does Joi set this property?
        detailsExists: !!err.details, // Does err.details exist?
        detailsIsArray: Array.isArray(err.details), // Is err.details an array?
        statusCodeFromError: err.statusCode // Does the error have a statusCode?
    });
    // Optionally, log the stack for non-production environments if it's still not clear
    // if (process.env.NODE_ENV !== 'production') {
    //   console.log('Error stack:', err.stack); 
    // }
  } else {
    console.log('Error handler reached, but the err object is null or undefined.');
  }
  // ***** END DEBUG LOG *****

  let statusCode = err?.statusCode || 500;
  let responseBody = { message: err?.message || 'An unexpected internal server error occurred.' };

  if (err && err.isJoi && Array.isArray(err.details)) {
    statusCode = 400;
    // This is the log you weren't seeing:
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      console.log('Joi error details (inside if block):', JSON.stringify(err.details, null, 2));
    }
    responseBody = {
      message: "Validation error",
      errors: err.details.map(detail => {
        let fieldName = 'unknown_field'; 
        // Simplify: Prioritize detail.path as it's clearly shown in logs
        if (Array.isArray(detail.path) && detail.path.length > 0) {
          fieldName = detail.path[0]; // Use the first element of the path array
        } else if (detail.context && typeof detail.context.key === 'string' && detail.context.key) {
          // Fallback if path is not available or not as expected
          fieldName = detail.context.key;
        } else if (typeof detail.context?.label === 'string' && detail.context.label) {
            // Further fallback
            fieldName = detail.context.label;
        }
        // No need for .join('.') if path is always a single element for these simple validations

        return {
          field: fieldName,
          message: (detail && typeof detail.message === 'string') ? detail.message.replace(/["']/g, "") : 'Invalid input'
        };
      })
    };
  } else if (err && err.name === 'UnauthorizedError') { 
    statusCode = 401;
    responseBody = { message: err.message || 'Unauthorized' };
  }
  // Add more specific error type handling here if needed

  if (!res.headersSent) {
    res.status(statusCode).json(responseBody);
  } else {
    console.error('errorHandler: Headers already sent. Cannot send error response.');
  }
};

module.exports = errorHandler;