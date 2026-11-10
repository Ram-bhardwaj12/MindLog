import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
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
 * Graceful shutdown handler.
 * Closes HTTP listener and releases database connections cleanly upon receiving termination signals.
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
      console.error('[Server Error] Error during database disconnect:', err);
      process.exit(1);
    }
  });

  // Force shutdown if cleanup hangs past 10 seconds
  setTimeout(() => {
    console.error('[Server] Shutdown timed out. Forcing termination.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

