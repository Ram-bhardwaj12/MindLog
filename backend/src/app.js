import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { defaultGeneralApiLimiter } from './middleware/rateLimiter.js';
import { enforceContentType } from './middleware/enforceContentType.js';
import { rejectOperatorKeys } from './middleware/rejectOperatorKeys.js';

/**
 * Creates the MindLog Express application with configurable middleware options.
 *
 * @param {object} [options]
 * @param {import('express').RequestHandler} [options.generalLimiter] - Optional override for general /api limiter
 * @returns {import('express').Express}
 */
export function createApp({ generalLimiter } = {}) {
  const app = express();

  // Explicitly remove X-Powered-By header (defense-in-depth alongside Helmet)
  app.disable('x-powered-by');

  /**
   * Reverse Proxy Configuration (Phase 8 & 9):
   * When TRUST_PROXY_HOPS > 0, Express trusts that exact number of upstream reverse proxy hops.
   * In production (Vercel proxy -> Render service), TRUST_PROXY_HOPS=2 ensures req.ip correctly
   * resolves to the true client IP from the right-most trusted entry in X-Forwarded-For.
   * An incorrect value either groups all users into one rate-limit bucket (if hops < actual)
   * or permits malicious clients to spoof arbitrary IPs via forged headers (if hops > actual).
   */
  if (env.trustProxyHops > 0) {
    app.set('trust proxy', env.trustProxyHops);
  }

  // Security headers with Helmet (enforces strict HSTS, frameguard, noSniff, xssFilter)
  app.use(helmet());

  /**
   * CORS Configuration:
   * - Dynamic origin check verifying against CLIENT_ORIGINS allow-list.
   * - Sets Vary: Origin header when reflecting allowed origins.
   * - maxAge: 600 caches CORS preflight OPTIONS responses in browsers for 10 minutes.
   * - credentials: true is required for HttpOnly authentication cookies.
   */
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (such as server-side rewrites, curl, or mobile clients)
      if (!origin) {
        return callback(null, true);
      }

      if (env.clientOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
    maxAge: 600, // Preflight cache duration in seconds
  };

  app.use(cors(corsOptions));

  // HTTP request logging (silent in automated test environment)
  if (!env.isTest) {
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  // General rate limiter on all /api routes except /api/health
  const activeGeneralLimiter = generalLimiter || (env.isTest ? (req, res, next) => next() : defaultGeneralApiLimiter);
  app.use('/api', activeGeneralLimiter);

  // Content-Type enforcement: requires application/json on mutating endpoints with payloads
  app.use('/api', enforceContentType);

  // Request parsers
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Early NoSQL injection defense: reject any payload, query or param with '$' or '.' object keys
  app.use('/api', rejectOperatorKeys);

  // Mount API routes under /api
  app.use('/api', apiRouter);

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Centralized error handling middleware
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;
