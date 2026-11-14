import { Router } from 'express';
import { register, login, logout, me } from '../controllers/auth.controller.js';
import { validate } from '../validators/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validators.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { defaultAuthLimiter, defaultEmailLoginLimiter } from '../middleware/rateLimiter.js';
import { env } from '../config/env.js';

/**
 * Creates the auth router with optional custom rate limiters.
 * In automated test suites, the default limiters are bypassed so tests do not get rate-limited,
 * while dedicated rate-limiting tests can supply tight limiter instances.
 *
 * @param {object} [options]
 * @param {import('express').RequestHandler} [options.limiter] - Per-IP login/register limiter
 * @param {import('express').RequestHandler} [options.emailLimiter] - Per-email login limiter
 * @returns {Router}
 */
export function createAuthRouter({ limiter, emailLimiter } = {}) {
  const router = Router();

  // In test mode, bypass rate limiting on standard routes unless explicitly provided
  const activeLimiter = limiter || (env.isTest ? (req, res, next) => next() : defaultAuthLimiter);
  const activeEmailLimiter = emailLimiter || (env.isTest ? (req, res, next) => next() : defaultEmailLoginLimiter);

  // POST /api/auth/register
  router.post('/register', activeLimiter, validate(registerSchema), register);

  // POST /api/auth/login
  // activeEmailLimiter is mounted AFTER body validation and in addition to the per-IP limiter.
  // It is keyed by SHA-256 hash of normalized email and responds identically for known/unknown emails.
  router.post('/login', activeLimiter, validate(loginSchema), activeEmailLimiter, login);

  // POST /api/auth/logout
  router.post('/logout', logout);

  // GET /api/auth/me
  router.get('/me', requireAuth, me);

  return router;
}

export default createAuthRouter();
