import { Router } from 'express';
import { register, login, logout, me } from '../controllers/auth.controller.js';
import { validate } from '../validators/validate.js';
import { registerSchema, loginSchema } from '../validators/auth.validators.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { defaultAuthLimiter } from '../middleware/rateLimiter.js';
import { env } from '../config/env.js';

/**
 * Creates the auth router with an optional custom rate limiter.
 * In automated test suites, the default limiter is bypassed so tests do not get rate-limited,
 * while dedicated rate-limiting tests can supply a tight limiter instance.
 *
 * @param {object} [options]
 * @param {import('express').RequestHandler} [options.limiter]
 * @returns {Router}
 */
export function createAuthRouter({ limiter } = {}) {
  const router = Router();

  // In test mode, bypass rate limiting on standard routes unless explicitly provided
  const activeLimiter = limiter || (env.isTest ? (req, res, next) => next() : defaultAuthLimiter);

  // POST /api/auth/register
  router.post('/register', activeLimiter, validate(registerSchema), register);

  // POST /api/auth/login
  router.post('/login', activeLimiter, validate(loginSchema), login);

  // POST /api/auth/logout
  router.post('/logout', logout);

  // GET /api/auth/me
  router.get('/me', requireAuth, me);

  return router;
}

export default createAuthRouter();

