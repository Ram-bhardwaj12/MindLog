/**
 * Cloudinary SDK configuration.
 *
 * Configures the official Cloudinary SDK v2 with credentials from validated environment variables.
 * Enforces secure HTTPS URL generation for all uploaded media assets.
 *
 * NOTE: Per project constraints, the Cloudinary SDK is imported strictly in this file
 * and in src/services/cloudinary.service.js.
 */

import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export default cloudinary;

