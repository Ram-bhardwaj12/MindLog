/**
 * Media Cleanup Service.
 *
 * Implements remote asset destruction from Cloudinary storage
 * when journal entries are permanently deleted or purged.
 *
 * Safety requirements:
 * - Runs best-effort in batches of 5 using Promise.allSettled
 * - Never throws (cannot abort or fail parent delete/purge operations)
 * - Logs only numerical counts, never publicIds, filenames, or secrets
 */

import { cloudinaryClient } from './cloudinary.service.js';

/**
 * Removes all Cloudinary assets associated with a list of Entry documents.
 *
 * @param {Array<object>} entries - Array of Entry documents containing media items
 * @returns {Promise<void>}
 */
export async function deleteMediaForEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return;
  }

  // 1. Collect all publicId and resourceType pairs from media subdocuments
  const assets = [];
  for (const entry of entries) {
    if (Array.isArray(entry.media)) {
      for (const item of entry.media) {
        if (item && item.publicId) {
          assets.push({
            publicId: item.publicId,
            resourceType: item.resourceType || 'image',
          });
        }
      }
    }
  }

  if (assets.length === 0) {
    return;
  }

  let deletedCount = 0;
  let failedCount = 0;

  // 2. Destroy assets in batches of 5 with concurrency control
  for (let i = 0; i < assets.length; i += 5) {
    const batch = assets.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map((asset) => cloudinaryClient.destroy(asset.publicId, asset.resourceType))
    );

    for (const res of results) {
      if (res.status === 'fulfilled') {
        deletedCount++;
      } else {
        failedCount++;
      }
    }
  }

  // 3. Log aggregate counts only (never credentials, URLs, or IDs)
  console.log(`[Media Cleanup] ${deletedCount} assets deleted, ${failedCount} failed`);
}
