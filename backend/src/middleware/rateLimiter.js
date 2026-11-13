import crypto from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import {
  API_LIMIT_WINDOW_MS,
  API_LIMIT_MAX,
  AUTH_LIMIT_WINDOW_MS,
  AUTH_LIMIT_MAX,
  AUTH_EMAIL_LIMIT_WINDOW_MS,
  AUTH_EMAIL_LIMIT_MAX,
  ENTRY_WRITE_LIMIT_WINDOW_MS,
  ENTRY_WRITE_LIMIT_MAX,
  MEDIA_UPLOAD_LIMIT_WINDOW_MS,
  MEDIA_UPLOAD_LIMIT_MAX,
} from '../config/limits.js';

/**
 * Standard 429 rate limit error handler.
 * Ensures uniform JSON response envelope across all endpoints and sets Retry-After header.
 *
 * @param {string} customMessage
 * @param {number} windowMs
 */
function createRateLimitHandler(customMessage, windowMs) {
  return (req, res, next, options) => {
    const retryAfterSeconds = Math.ceil(windowMs / 1000);
    if (!res.getHeader('Retry-After')) {
      res.setHeader('Retry-After', retryAfterSeconds);
    }

    const message = customMessage || options?.message || 'Too many requests, please try again later';

    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message,
        details: [],
      },
    });
  };
}

/**
 * General API Limiter Factory.
 * Applies to all /api routes except /api/health.
 * Keyed by client IP (normalized using ipKeyGenerator).
 */
export function createGeneralApiLimiter({
  windowMs = API_LIMIT_WINDOW_MS,
  max = API_LIMIT_MAX,
  message = 'Too many requests to the MindLog API, please try again later',
  skip,
} = {}) {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
    skip: skip || ((req) => req.path === '/health' || req.originalUrl === '/api/health'),
    handler: createRateLimitHandler(message, windowMs),
  });
}

/**
 * Authentication Rate Limiter Factory (Per IP).
 * Applied to POST /api/auth/register and POST /api/auth/login.
 * Keyed by client IP.
 */
export function createAuthRateLimiter({
  windowMs = AUTH_LIMIT_WINDOW_MS,
  max = AUTH_LIMIT_MAX,
  message = 'Too many authentication attempts from this IP, please try again after 15 minutes',
} = {}) {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip || '127.0.0.1'),
    handler: createRateLimitHandler(message, windowMs),
  });
}

/**
 * Per-Email Login Rate Limiter Factory (Account Takeover Defense).
 * Applied to POST /api/auth/login AFTER request body validation.
 * Keyed by SHA-256 hash of normalized email address.
 * Responds identically regardless of whether the email exists in the database.
 */
export function createEmailLoginLimiter({
  windowMs = AUTH_EMAIL_LIMIT_WINDOW_MS,
  max = AUTH_EMAIL_LIMIT_MAX,
  message = 'Too many login attempts for this account, please try again after 15 minutes',
} = {}) {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
      return crypto.createHash('sha256').update(email).digest('hex');
    },
    handler: createRateLimitHandler(message, windowMs),
  });
}

/**
 * Per-User Entry Mutation Limiter Factory (Write Operations).
 * Applied to POST, PUT, PATCH, DELETE on journal entries (excluding media upload).
 * Keyed strictly by authenticated user ID (never IP).
 */
export function createEntryWriteLimiter({
  windowMs = ENTRY_WRITE_LIMIT_WINDOW_MS,
  max = ENTRY_WRITE_LIMIT_MAX,
  message = 'Entry write limit exceeded, please wait before making further changes',
} = {}) {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?._id || req.user?.id || 'anonymous'),
    handler: createRateLimitHandler(message, windowMs),
  });
}

/**
 * Per-User Media Upload Limiter Factory.
 * Applied to POST /api/entries/:id/media BEFORE Multer processes multipart streams.
 * Keyed strictly by authenticated user ID (never IP).
 */
export function createMediaUploadLimiter({
  windowMs = MEDIA_UPLOAD_LIMIT_WINDOW_MS,
  max = MEDIA_UPLOAD_LIMIT_MAX,
  message = 'Media upload limit exceeded (maximum 30 uploads per hour)',
} = {}) {
  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?._id || req.user?.id || 'anonymous'),
    handler: createRateLimitHandler(message, windowMs),
  });
}

// Default pre-configured limiter instances
export const defaultGeneralApiLimiter = createGeneralApiLimiter();
export const defaultAuthLimiter = createAuthRateLimiter();
export const defaultEmailLoginLimiter = createEmailLoginLimiter();
export const defaultEntryWriteLimiter = createEntryWriteLimiter();
export const defaultMediaUploadLimiter = createMediaUploadLimiter();
