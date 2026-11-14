import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Sweeps the temporary upload directory and deletes orphaned files older than 1 hour.
 * Called once at server startup after database connection. Never throws operational errors.
 *
 * @returns {Promise<void>}
 */
export async function sweepTempUploads() {
  try {
    const dir = env.mediaTmpDir;
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const now = Date.now();
    let sweptCount = 0;

    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name);
        try {
          const stats = await fs.promises.stat(fullPath);
          if (now - stats.mtimeMs > ONE_HOUR_MS) {
            await fs.promises.unlink(fullPath);
            sweptCount++;
          }
        } catch {
          // Ignore concurrent file deletions or transient stat errors
        }
      }
    }

    if (sweptCount > 0) {
      console.log(`[Temp Sweep] Cleaned up ${sweptCount} stale temporary upload files.`);
    }
  } catch (err) {
    console.warn('[Temp Sweep Warning] Unable to sweep temporary upload directory:', err.message);
  }
}

