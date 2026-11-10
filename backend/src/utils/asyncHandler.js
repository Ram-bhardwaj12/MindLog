/**
 * Wraps an asynchronous Express route handler or middleware.
 * Catches any rejected promises and forwards the error to next().
 *
 * NOTE: Express 4 does not automatically catch unhandled promise rejections
 * from async route handlers (unlike Express 5). Wrapping handlers with asyncHandler
 * guarantees that all asynchronous errors reach the centralized errorHandler.
 *
 * @param {Function} fn - Async Express handler function (req, res, next)
 * @returns {Function} Express middleware handler
 */
export function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

