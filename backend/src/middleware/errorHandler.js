import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Centralized Express error-handling middleware.
 * Formats every operational and runtime error into the standard API error envelope:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "...",
 *     "message": "...",
 *     "details": []
 *   }
 * }
 */
export function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected internal server error occurred';
  let details = [];

  // 1. Explicit ApiError thrown inside application code
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details || [];
  }
  // 2. Mongoose Schema Validation error
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }
  // 3. Mongoose CastError (e.g. malformed ObjectId in route parameter)
  else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = `Invalid value for parameter: ${err.path}`;
    details = [{ field: err.path, message: 'Invalid identifier format' }];
  }
  // 4. MongoDB duplicate key error (E11000)
  else if (err.code === 11000) {
    statusCode = 409;
    code = 'CONFLICT';
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    message = `A resource with this ${field} already exists`;
    details = [{ field, message: 'Duplicate value not allowed' }];
  }
  // 5. Body-parser invalid JSON syntax error
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = 'Malformed JSON in request body';
  }
  // 6. Body-parser payload too large
  else if (err.type === 'entity.too.large' || err.status === 413) {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request payload exceeds the maximum permitted size (2MB)';
  }
  // 7. Multer file upload errors
  else if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      code = 'PAYLOAD_TOO_LARGE';
      message = 'File exceeds maximum permitted size';
    } else {
      statusCode = 400;
      code = 'BAD_REQUEST';
      message = err.message || 'File upload error';
    }
  }
  // 8. CORS origin rejection
  else if (err.message === 'Not allowed by CORS') {
    statusCode = 403;
    code = 'FORBIDDEN';
    message = 'Origin is not permitted by CORS policy';
  }
  // 9. Unexpected internal errors
  else {
    // Always log unexpected runtime errors server-side for debugging
    console.error('[Unhandled Server Error]', err);

    if (!env.isProduction) {
      message = err.message || message;
    }
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}

