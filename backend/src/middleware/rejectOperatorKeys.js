import { ApiError } from '../utils/ApiError.js';

/**
 * Checks an object recursively up to maxDepth for keys starting with '$' or containing '.'.
 *
 * @param {*} value
 * @param {number} [depth=0]
 * @param {number} [maxDepth=10]
 * @returns {boolean} True if any forbidden operator key is detected
 */
function containsOperatorKey(value, depth = 0, maxDepth = 10) {
  if (!value || typeof value !== 'object' || depth > maxDepth) {
    return false;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      if (containsOperatorKey(item, depth + 1, maxDepth)) {
        return true;
      }
    }
    return false;
  }

  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) {
      return true;
    }
    const child = value[key];
    if (child && typeof child === 'object') {
      if (containsOperatorKey(child, depth + 1, maxDepth)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Early NoSQL Injection Defense-in-Depth Middleware.
 *
 * Scans req.body, req.query, and req.params recursively (with depth limit 10).
 * Immediately rejects with 400 BAD_REQUEST ("Invalid request") any payload
 * containing object keys starting with '$' (MongoDB operator injection) or
 * containing '.' (path traversal / prototype pollution injection).
 *
 * NOTE ON MULTIPART/FORM-DATA:
 * Multipart text fields are parsed later by Multer in specific upload routes.
 * They are already protected by strict Zod schema validation and Mongoose sanitizeFilter.
 * This middleware catches all JSON and URL query operator injection attempts early,
 * before any database operations or validation handlers are invoked.
 */
export function rejectOperatorKeys(req, res, next) {
  if (
    containsOperatorKey(req.body) ||
    containsOperatorKey(req.query) ||
    containsOperatorKey(req.params)
  ) {
    return next(ApiError.badRequest('Invalid request'));
  }
  next();
}

