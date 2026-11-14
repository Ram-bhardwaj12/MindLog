import { ApiError } from '../utils/ApiError.js';

/**
 * 404 handler for routes that are not registered.
 * Written without route path strings so it is universally compatible with Express 4 and 5.
 */
export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
}

