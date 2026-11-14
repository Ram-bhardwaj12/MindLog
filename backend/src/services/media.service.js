import { Entry } from '../models/Entry.js';
import { ApiError } from '../utils/ApiError.js';
import { isValidObjectId } from '../utils/objectId.js';
import { cloudinaryClient } from './cloudinary.service.js';
import { cleanupFiles } from '../middleware/upload.js';
import { MAX_MEDIA_PER_ENTRY } from '../config/media.js';

/**
 * Concurrency runner capping parallel tasks at `limit`.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Uploads up to 5 media files and attaches them atomically to an active entry.
 *
 * Enforces:
 * - Maximum 20 attachments per entry total
 * - Cloudinary streaming upload with concurrency <= 3
 * - All-or-nothing rollback: any upload failure immediately destroys earlier uploaded assets
 * - Atomic database $push
 * - Race-compensation: if entry was deleted/trashed mid-upload, uploaded assets are destroyed and 404 is thrown
 * - Always unlinks all temporary disk files in finally block
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {import('mongoose').Document} entry - Pre-loaded active entry document
 * @param {Array<Express.Multer.File>} files - Validated Multer files
 * @returns {Promise<import('mongoose').Document>} Updated entry document
 */
export async function addMediaToEntry(userId, entry, files) {
  try {
    // 1. Enforce attachment ceiling (max 20 per entry)
    const existingCount = entry.media ? entry.media.length : 0;
    if (existingCount + files.length > MAX_MEDIA_PER_ENTRY) {
      throw ApiError.badRequest('Attachment limit reached (max 20 per entry)');
    }

    const folder = `mindlog/${userId}/${entry._id}`;
    const uploadedAssets = [];

    // 2. Upload files to Cloudinary with concurrency at most 3
    let uploadedDocs;
    try {
      uploadedDocs = await mapConcurrent(files, 3, async (file) => {
        const result = await cloudinaryClient.uploadFromPath(file.path, {
          folder,
          resourceType: file.cloudinaryResourceType || 'image',
        });

        const assetRecord = {
          publicId: result.publicId,
          resourceType: result.resourceType,
        };
        uploadedAssets.push(assetRecord);

        return {
          kind: file.detectedKind,
          url: result.url,
          name: file.sanitizedName,
          publicId: result.publicId,
          resourceType: result.resourceType,
          mimeType: file.detectedMime,
          sizeBytes: file.size,
        };
      });
    } catch (uploadError) {
      // Rollback: Destroy any assets that were already uploaded during this request
      if (uploadedAssets.length > 0) {
        await Promise.allSettled(
          uploadedAssets.map((asset) =>
            cloudinaryClient.destroy(asset.publicId, asset.resourceType)
          )
        );
      }
      throw uploadError instanceof ApiError
        ? uploadError
        : ApiError.uploadFailed('Media upload failed');
    }

    // 3. Atomically attach media subdocuments to the active entry
    const updatedEntry = await Entry.findOneAndUpdate(
      { _id: entry._id, userId, deletedAt: null },
      { $push: { media: { $each: uploadedDocs } } },
      { new: true }
    );

    // 4. Race-condition check: if the entry was deleted or soft-deleted while uploading
    if (!updatedEntry) {
      if (uploadedAssets.length > 0) {
        await Promise.allSettled(
          uploadedAssets.map((asset) =>
            cloudinaryClient.destroy(asset.publicId, asset.resourceType)
          )
        );
      }
      throw ApiError.notFound('Entry not found');
    }

    return updatedEntry;
  } finally {
    // 5. Always remove temporary disk files regardless of success or failure
    await cleanupFiles(files);
  }
}

/**
 * Removes a single media item from an entry and destroys its remote asset.
 *
 * Sequence:
 * - Verifies mediaId format and active entry ownership (404 on mismatch)
 * - Performs database $pull first
 * - Destroys the remote asset from Cloudinary best-effort (failure does not fail request)
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} entryId
 * @param {string} mediaId
 * @returns {Promise<import('mongoose').Document>} Updated entry document
 */
export async function removeMediaFromEntry(userId, entryId, mediaId) {
  if (!isValidObjectId(mediaId)) {
    throw ApiError.notFound('Media not found');
  }

  // Load entry to verify ownership and find the targeted media subdocument
  const entry = await Entry.findOne({ _id: entryId, userId, deletedAt: null });
  if (!entry) {
    throw ApiError.notFound('Entry not found');
  }

  const mediaItem = entry.media.id(mediaId);
  if (!mediaItem) {
    throw ApiError.notFound('Media not found');
  }

  const publicId = mediaItem.publicId;
  const resourceType = mediaItem.resourceType || 'image';

  // 1. Remove from database FIRST
  const updatedEntry = await Entry.findOneAndUpdate(
    { _id: entryId, userId, deletedAt: null },
    { $pull: { media: { _id: mediaId } } },
    { new: true }
  );

  // 2. Best-effort Cloudinary asset destruction
  try {
    await cloudinaryClient.destroy(publicId, resourceType);
  } catch {
    console.warn('[Cloudinary Warning] Asset destruction call failed during media removal.');
  }

  return updatedEntry;
}

