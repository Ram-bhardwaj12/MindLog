import rateLimit from 'express-rate-limit';

/**
 * Creates an Express rate limiter returning standard API error envelopes:
 * { "success": false, "error": { "code": "TOO_MANY_REQUESTS", ... } }
 *
 * NOTE ON PROXIES:
 * Behind the Vercel-to-Render reverse proxy chain, the client's actual IP address
 * depends on the 'trust proxy' setting configured in src/app.js.
 * This must be verified during production deployment testing in Phase 9.
 *
 * @param {object} options
 * @param {number} [options.windowMs=15*60*1000] - 15 minutes window
 * @param {number} [options.max=10] - Max requests permitted per window
 * @param {string} [options.message] - Custom message
 * @returns {import('express').RequestHandler} Rate limiting middleware
 */
export function createAuthRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = 'Too many authentication attempts, please try again later',
} = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Return standard RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message,
          details: [],
        },
      });
    },
  });
}

// Default auth limiter: 10 requests per 15 minutes per IP
export const defaultAuthLimiter = createAuthRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
});

