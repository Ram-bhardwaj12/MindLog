import mongoose from 'mongoose';
import { sendSuccess } from '../utils/apiResponse.js';

/**
 * Health check controller.
 * Reports server status, current timestamp, process uptime, and database connectivity.
 */
export function getHealth(req, res) {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const isDbConnected = mongoose.connection.readyState === 1;

  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: isDbConnected ? 'connected' : 'disconnected',
  };

  return sendSuccess(res, healthData, 200);
}

