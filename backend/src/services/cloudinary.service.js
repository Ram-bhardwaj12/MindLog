/**
 * Cloudinary API Service.
 *
 * Provides a mockable client object for streaming uploads and asset destruction.
 * Never leaks SDK internal errors, credentials, or filesystem paths to clients.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from '../utils/ApiError.js';

/**
 * Mutable Cloudinary client wrapper.
 * Methods are called through the object reference to allow test suite mocking via mock.method().
 */
export const cloudinaryClient = {
  /**
   * Uploads a file by streaming from the temporary filesystem path.
   *
   * @param {string} filePath - Absolute path to temporary uploaded file
   * @param {object} options
   * @param {string} options.folder - Destination folder (e.g. mindlog/{userId}/{entryId})
   * @param {'image'|'video'} options.resourceType - Cloudinary resource type
   * @returns {Promise<{ publicId: string, url: string, resourceType: string, bytes: number }>}
   */
  async uploadFromPath(filePath, { folder, resourceType }) {
    return new Promise((resolve, reject) => {
      const publicId = crypto.randomUUID();
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: resourceType,
          overwrite: false,
          type: 'upload',
        },
        (error, result) => {
          if (error) {
            console.warn('[Cloudinary Warning] Asset upload stream rejected by Cloudinary.');
            return reject(new ApiError(502, 'Media upload failed', 'UPLOAD_FAILED'));
          }
          resolve({
            publicId: result.public_id,
            url: result.secure_url,
            resourceType: result.resource_type || resourceType,
            bytes: result.bytes || 0,
          });
        }
      );

      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', () => {
        console.warn('[Cloudinary Warning] Failed to read temporary upload file from disk.');
        reject(new ApiError(502, 'Media upload failed', 'UPLOAD_FAILED'));
      });
      fileStream.pipe(uploadStream);
    });
  },

  /**
   * Destroys an uploaded media asset from Cloudinary storage.
   *
   * @param {string} publicId - Cloudinary public identifier
   * @param {'image'|'video'} [resourceType='image'] - Cloudinary resource type
   * @returns {Promise<object>}
   */
  async destroy(publicId, resourceType = 'image') {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
      return result;
    } catch {
      console.warn('[Cloudinary Warning] Asset destruction call failed.');
      throw new ApiError(502, 'Media deletion failed', 'UPLOAD_FAILED');
    }
  },
};

