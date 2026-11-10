import mongoose from 'mongoose';
import { env } from './env.js';
import { applyDnsServers } from './dns.js';

/**
 * Connects Mongoose to the MongoDB Atlas cluster.
 * Fails safely without ever logging or leaking the connection URI.
 */
export async function connectDB() {
  applyDnsServers(env.DNS_SERVERS);

  if (!env.MONGODB_URI) {
    console.error('[Database Error] Cannot connect: MONGODB_URI is not defined in environment.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`[Database] Connected successfully to MongoDB host: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error('========================================================================');
    console.error('[Database Connection Error] Failed to connect to MongoDB Atlas.');
    console.error('  Message:', err.message);
    console.error('  Hint: Verify your MongoDB Atlas credentials, ensure your current IP is');
    console.error('        allowed under Network Access, and check that the cluster is running.');
    if (err.message && (err.message.includes('querySrv') || err.message.includes('ENOTFOUND'))) {
      console.error('        For SRV resolution errors, set DNS_SERVERS=8.8.8.8,1.1.1.1 in backend/.env');
      console.error('        or use Atlas non-SRV connection string (Connect -> Drivers -> Legacy URI String).');
    }
    console.error('========================================================================');
    process.exit(1);
  }
}

/**
 * Disconnects Mongoose connection cleanly during server shutdown or test teardown.
 */
export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    console.log('[Database] MongoDB connection closed cleanly.');
  }
}

