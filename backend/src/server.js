import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import './config/cloudinary.js';
import { sweepTempUploads } from './utils/tempSweep.js';

// Connect to MongoDB Atlas before starting the HTTP listener
await connectDB();

// Sweep stale (> 1 hour old) temporary upload files on startup
await sweepTempUploads();

const server = app.listen(env.PORT, () => {
  console.log(`[Server] MindLog API running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
  console.log(`[Server] Health check endpoint accessible at http://localhost:${env.PORT}/api/health`);
});

/**
 * Server Network & Keep-Alive Timeouts (Phase 8):
 *
 * Reverse proxies (Vercel and Render) maintain persistent keep-alive connection pools.
 * If the upstream Node server closes an idle connection before or concurrently with the proxy,
 * a race condition occurs resulting in 502 Bad Gateway / ECONNRESET errors.
 *
 * Requirements:
 * - keepAliveTimeout must exceed proxy keep-alive timeouts (Render ~60s, Vercel ~60s) -> 65,000ms.
 * - headersTimeout must be strictly greater than keepAliveTimeout per Node.js specifications -> 66,000ms.
 * - requestTimeout must allow up to 5 minutes (300,000ms) for slow, high-latency 50MB media file uploads.
 */
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 300000;

/**
 * Graceful shutdown handler.
 * Closes HTTP listener and releases database connections cleanly upon receiving termination signals.
 *
 * @param {string} signal
 */
async function handleShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('[Server] HTTP listener closed.');
    try {
      await disconnectDB();
      console.log('[Server] Graceful shutdown complete. Exiting.');
      process.exit(0);
    } catch (err) {
      console.error('[Server Error] Error during database disconnect:', err?.name || 'Error');
      process.exit(1);
    }
  });

  // Force shutdown if cleanup hangs past 10 seconds
  setTimeout(() => {
    console.error('[Server] Shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 10000).unref();
}

/**
 * Crash safeguards for unhandled asynchronous rejections and uncaught exceptions.
 * To adhere strictly to security standards, these log ONLY the error name and a generic
 * message, NEVER printing error message strings or stack traces (which could leak tokens,
 * passwords, or sensitive user content into server logs).
 *
 * @param {'unhandledRejection'|'uncaughtException'} type
 * @param {Error|unknown} err
 */
function handleFatalCrash(type, err) {
  const errorName = (err && typeof err === 'object' && 'name' in err) ? err.name : 'UnknownError';
  console.error(`[Fatal Process Error] ${type} encountered: ${errorName}. Initiating emergency shutdown.`);

  // 10-second forced termination guard
  setTimeout(() => {
    process.exit(1);
  }, 10000).unref();

  try {
    server.close(async () => {
      try {
        await disconnectDB();
      } catch {
        // Suppress errors during emergency database disconnect
      }
      process.exit(1);
    });
  } catch {
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => handleFatalCrash('unhandledRejection', reason));
process.on('uncaughtException', (error) => handleFatalCrash('uncaughtException', error));

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
