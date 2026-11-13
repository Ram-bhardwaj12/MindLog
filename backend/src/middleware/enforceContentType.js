import { ApiError } from '../utils/ApiError.js';

/**
 * Middleware enforcing Content-Type constraints across all state-changing endpoints.
 *
 * Rules:
 * - GET, HEAD, OPTIONS, DELETE requests are exempt.
 * - POST, PUT, and PATCH to standard JSON routes must carry Content-Type: application/json.
 * - Multipart/form-data is strictly permitted ONLY on the media upload endpoint (POST /api/entries/:id/media).
 * - Body-less actions (logout, trash, restore, delete) succeed even without a Content-Type header.
 */
export function enforceContentType(req, res, next) {
  const method = req.method.toUpperCase();

  // Only validate methods that can transmit request bodies
  if (!['POST', 'PUT', 'PATCH'].includes(method)) {
    return next();
  }

  const cleanUrl = (req.originalUrl || req.url).split('?')[0];

  // 1. Dedicated media upload route check
  const isMediaUploadRoute = /^\/api\/entries\/[^/]+\/media\/?$/.test(cleanUrl);
  if (isMediaUploadRoute) {
    if (req.headers['content-type'] && !req.is('multipart/*')) {
      return next(ApiError.unsupportedMediaType('Media upload endpoint requires multipart/form-data'));
    }
    return next();
  }

  // 2. Reject multipart payloads on all non-media routes
  if (req.is('multipart/*')) {
    return next(ApiError.unsupportedMediaType('Multipart requests are only permitted on media upload endpoints'));
  }

  // 3. Exempt known body-less routes (logout, trash, restore)
  const isBodylessRoute =
    /^\/api\/entries\/[^/]+\/(trash|restore)\/?$/.test(cleanUrl) ||
    cleanUrl === '/api/auth/logout';

  if (isBodylessRoute) {
    return next();
  }

  // 4. All other POST, PUT, PATCH endpoints must carry application/json
  if (!req.is('application/json')) {
    return next(
      ApiError.unsupportedMediaType('Requests with a payload must carry Content-Type: application/json')
    );
  }

  next();
}
