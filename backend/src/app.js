import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

// Instantiate the Express application
const app = express();

/**
 * Trust reverse proxy hops (e.g. Vercel, Render, Railway, Cloudflare).
 * Crucial in production so that Express correctly identifies client protocol (https)
 * and issues secure HttpOnly cookies properly.
 */
if (env.isProduction) {
  app.set('trust proxy', 1);
}

// Security headers with Helmet
app.use(helmet());

/**
 * CORS Configuration:
 * - Dynamic origin check verifying against CLIENT_ORIGINS allow-list.
 * - Requests without an Origin header (e.g. curl, postman, or server-side Vercel rewrites) are permitted.
 * - credentials: true is required to allow browser to receive and send HttpOnly authentication cookies.
 *
 * NOTE: Wildcard origin ('*') is strictly forbidden when credentials: true is set.
 * The W3C Fetch standard explicitly rejects any response carrying credentials if the
 * Access-Control-Allow-Origin header is '*', causing the browser to throw a CORS error.
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (such as same-origin reverse-proxy or command-line tools)
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
};

app.use(cors(corsOptions));

// HTTP request logging (silent in automated test environment)
if (!env.isTest) {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

// Request parsers
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Mount API routes under /api
app.use('/api', apiRouter);

// 404 handler for unmatched routes (registered without path string for Express 4/5 compatibility)
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

export default app;

