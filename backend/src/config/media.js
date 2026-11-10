/**
 * Media Configuration & Type Registry.
 *
 * Defines size limits, batching thresholds, and strict byte-level allowed MIME types
 * for image, video, and audio uploads.
 */

export const MAX_FILES_PER_REQUEST = 5;
export const MAX_MEDIA_PER_ENTRY = 20;

export const SIZE_LIMITS_BYTES = {
  image: 10 * 1024 * 1024, // 10 MB
  audio: 20 * 1024 * 1024, // 20 MB
  video: 50 * 1024 * 1024, // 50 MB
};

// Maximum threshold passed to Multer diskStorage (capped at highest single file limit)
export const MULTER_MAX_FILE_SIZE = SIZE_LIMITS_BYTES.video;

/**
 * Allowed Media Type Table.
 *
 * Mapped against byte-level detected MIME types from `file-type`.
 * Note: Cloudinary stores audio assets under the 'video' resourceType.
 * Explicitly disallows: SVG (XSS vector), HEIC/HEIF, AVIF, BMP, TIFF, and plain text.
 */
export const ALLOWED_MEDIA_TYPES = {
  // Images (Cloudinary resource_type: 'image')
  'image/jpeg': {
    kind: 'image',
    cloudinaryResourceType: 'image',
    maxSizeBytes: SIZE_LIMITS_BYTES.image,
  },
  'image/png': {
    kind: 'image',
    cloudinaryResourceType: 'image',
    maxSizeBytes: SIZE_LIMITS_BYTES.image,
  },
  'image/webp': {
    kind: 'image',
    cloudinaryResourceType: 'image',
    maxSizeBytes: SIZE_LIMITS_BYTES.image,
  },
  'image/gif': {
    kind: 'image',
    cloudinaryResourceType: 'image',
    maxSizeBytes: SIZE_LIMITS_BYTES.image,
  },

  // Video (Cloudinary resource_type: 'video')
  'video/mp4': {
    kind: 'video',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.video,
  },
  'video/webm': {
    kind: 'video',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.video,
  },
  'video/quicktime': {
    kind: 'video',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.video,
  },

  // Audio (Cloudinary resource_type: 'video')
  'audio/mpeg': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
  'audio/mp4': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
  'audio/x-m4a': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
  'audio/wav': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
  'audio/x-wav': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
  'audio/wave': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
  'audio/ogg': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
  'audio/ogg; codecs=opus': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
  'audio/opus': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
  'audio/vorbis': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
  'application/ogg': {
    kind: 'audio',
    cloudinaryResourceType: 'video',
    maxSizeBytes: SIZE_LIMITS_BYTES.audio,
  },
};

/**
 * Resolves media type metadata from a detected MIME type.
 *
 * @param {string} mimeType
 * @returns {{ kind: 'image'|'video'|'audio', cloudinaryResourceType: 'image'|'video', maxSizeBytes: number } | null}
 */
export function getMediaTypeInfo(mimeType) {
  if (!mimeType) return null;
  // Normalize parameters if present
  const baseMime = mimeType.split(';')[0].trim().toLowerCase();
  return ALLOWED_MEDIA_TYPES[mimeType] || ALLOWED_MEDIA_TYPES[baseMime] || null;
}

