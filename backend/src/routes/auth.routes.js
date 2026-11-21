import { Router } from 'express';
import { register, login, logout, me, forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import { validate } from '../validators/validate.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validators.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  defaultAuthLimiter,
  defaultEmailLoginLimiter,
  defaultForgotPasswordLimiter,
  defaultForgotPasswordEmailLimiter,
  defaultResetPasswordLimiter,
} from '../middleware/rateLimiter.js';
import { env } from '../config/env.js';

/**
 * Creates the auth router with optional custom rate limiters.
 * In automated test suites, the default limiters are bypassed so tests do not get rate-limited,
 * while dedicated rate-limiting tests can supply tight limiter instances.
 *
 * @param {object} [options]
 * @param {import('express').RequestHandler} [options.limiter] - Per-IP login/register limiter
 * @param {import('express').RequestHandler} [options.emailLimiter] - Per-email login limiter
 * @param {import('express').RequestHandler} [options.forgotLimiter] - Per-IP forgot-password limiter
 * @param {import('express').RequestHandler} [options.forgotEmailLimiter] - Per-email forgot-password limiter
 * @param {import('express').RequestHandler} [options.resetLimiter] - Per-IP reset-password limiter
 * @returns {Router}
 */
export function createAuthRouter({
  limiter,
  emailLimiter,
  forgotLimiter,
  forgotEmailLimiter,
  resetLimiter,
} = {}) {
  const router = Router();

  // In test mode, bypass rate limiting on standard routes unless explicitly provided
  const activeLimiter = limiter || (env.isTest ? (req, res, next) => next() : defaultAuthLimiter);
  const activeEmailLimiter = emailLimiter || (env.isTest ? (req, res, next) => next() : defaultEmailLoginLimiter);
  const activeForgotLimiter = forgotLimiter || (env.isTest ? (req, res, next) => next() : defaultForgotPasswordLimiter);
  const activeForgotEmailLimiter = forgotEmailLimiter || (env.isTest ? (req, res, next) => next() : defaultForgotPasswordEmailLimiter);
  const activeResetLimiter = resetLimiter || (env.isTest ? (req, res, next) => next() : defaultResetPasswordLimiter);

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

  // POST /api/auth/forgot-password (Phase 7)
  // activeForgotEmailLimiter is mounted AFTER body validation and in addition to the per-IP limiter.
  // It is keyed by SHA-256 hash of normalized email and responds identically for known/unknown emails.
  router.post(
    '/forgot-password',
    activeForgotLimiter,
    validate(forgotPasswordSchema),
    activeForgotEmailLimiter,
    forgotPassword
  );

  // POST /api/auth/reset-password (Phase 7)
  router.post(
    '/reset-password',
    activeResetLimiter,
    validate(resetPasswordSchema),
    resetPassword
  );

  return router;
}

export default createAuthRouter();
