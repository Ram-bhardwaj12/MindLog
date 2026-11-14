/**
 * Standard custom error class for operational API errors.
 * Ensures consistent error codes, HTTP status codes, and optional detail arrays.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (e.g. 400, 401, 404, 500)
   * @param {string} code - Machine-readable error code (e.g. 'VALIDATION_ERROR')
   * @param {string} message - Human-readable error description
   * @param {Array} [details=[]] - Optional list of specific validation errors or field details
   */
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details = []) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static validationError(message = 'Validation failed', details = []) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required', details = []) {
    return new ApiError(401, 'UNAUTHORIZED', message, details);
  }

  static forbidden(message = 'Access forbidden', details = []) {
    return new ApiError(403, 'FORBIDDEN', message, details);
  }

  static notFound(message = 'Requested resource not found', details = []) {
    return new ApiError(404, 'NOT_FOUND', message, details);
  }

  static conflict(message = 'Resource conflict', details = []) {
    return new ApiError(409, 'CONFLICT', message, details);
  }

  static payloadTooLarge(message = 'Payload exceeds maximum allowed size', details = []) {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', message, details);
  }

  static unsupportedMediaType(message = 'Unsupported media type', details = []) {
    return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', message, details);
  }

  static tooManyRequests(message = 'Too many requests, please try again later', details = []) {
    return new ApiError(429, 'TOO_MANY_REQUESTS', message, details);
  }

  static uploadFailed(message = 'Media upload failed', details = []) {
    return new ApiError(502, 'UPLOAD_FAILED', message, details);
  }

  static internal(message = 'An unexpected internal server error occurred', details = []) {
    return new ApiError(500, 'INTERNAL_ERROR', message, details);
  }
}

