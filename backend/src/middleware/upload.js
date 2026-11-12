import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { fileTypeFromFile } from 'file-type';
import { env } from '../config/env.js';
import {
  MAX_FILES_PER_REQUEST,
  MULTER_MAX_FILE_SIZE,
  getMediaTypeInfo,
} from '../config/media.js';
import { ApiError } from '../utils/ApiError.js';
import { sanitizeFileName } from '../utils/sanitizeFileName.js';
import { Entry } from '../models/Entry.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Ensures temporary directory exists and saves incoming files under random UUID filenames.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(env.mediaTmpDir, { recursive: true });
      cb(null, env.mediaTmpDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    // Generate unguessable random UUID filename on disk; never use client-provided filename
    cb(null, crypto.randomUUID());
  },
});

/**
 * Coarse initial filter: rejects files whose claimed MIME type does not start with
 * image/, video/, or audio/. Detailed byte-level verification happens in validateUploadedFiles.
 */
function fileFilter(req, file, cb) {
  const claimed = (file.mimetype || '').toLowerCase();
  if (
    claimed.startsWith('image/') ||
    claimed.startsWith('video/') ||
    claimed.startsWith('audio/')
  ) {
    cb(null, true);
  } else {
    cb(ApiError.unsupportedMediaType('Unsupported media type: claimed format must be image, video, or audio'));
  }
}

const multerInstance = multer({
  storage,
  limits: {
    fileSize: MULTER_MAX_FILE_SIZE, // 50 MB (capped at highest single file limit)
    files: MAX_FILES_PER_REQUEST,   // 5
  },
  fileFilter,
});

/**
 * Helper to safely delete an array of Multer temporary files from disk.
 * Never throws, ensuring cleanup routines cannot crash execution.
 *
 * @param {Array<Express.Multer.File>} files
 */
export async function cleanupFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return;
  await Promise.allSettled(
    files.map(async (file) => {
      if (file?.path) {
        try {
          await fs.promises.unlink(file.path);
        } catch {
          // File already deleted or moved; ignore
        }
      }
    })
  );
}

/**
 * Middleware that loads and validates ownership of an active (non-trashed) journal entry.
 *
 * CRITICAL SECURITY & RESOURCE CONTROL:
 * This middleware runs BEFORE Multer file streaming. If the entry does not exist,
 * belongs to another user, or is currently in the trash, it immediately aborts with 404 NOT_FOUND.
 * As a result, no incoming file bytes are ever accepted, written to disk, or processed
 * for invalid or unauthorized requests.
 */
export const loadOwnedActiveEntry = asyncHandler(async (req, res, next) => {
  const entry = await Entry.findOne({
    _id: req.params.id,
    userId: req.user._id,
    deletedAt: null,
  });

  if (!entry) {
    throw ApiError.notFound('Entry not found');
  }

  req.entry = entry;
  next();
});

/**
 * Multer wrapper middleware for array upload of field 'files'.
 * Enforces file count, traps Multer errors, handles empty uploads,
 * and binds client disconnect cleanup hooks.
 */
export function uploadMiddleware(req, res, next) {
  multerInstance.array('files', MAX_FILES_PER_REQUEST)(req, res, (err) => {
    if (err) {
      cleanupFiles(req.files);
      return next(err);
    }

    if (!req.files || req.files.length === 0) {
      return next(ApiError.badRequest('No files uploaded'));
    }

    // NOTE: Temp file cleanup is handled exclusively in media.service.js (finally block).
    // We deliberately do NOT attach a 'close' listener here because the Vite proxy
    // closes the upstream connection while the Cloudinary upload stream is still reading
    // the temp file, which caused premature deletion and 502 errors.

    next();
  });
}

/**
 * Strict byte-level inspection middleware.
 * Uses `file-type` to inspect the initial byte signatures of each uploaded file on disk.
 *
 * Rules:
 * - Reject whole request if any file is undetectable (e.g. text file or unknown format)
 * - Reject whole request if detected MIME type is not in ALLOWED_MEDIA_TYPES (e.g. SVG)
 * - Reject whole request if file size exceeds the limit for its detected kind (e.g. image > 10MB)
 * - Determines true media kind from detected bytes, regardless of filename extension
 * - Populates file.detectedKind, file.detectedMime, file.cloudinaryResourceType, file.sanitizedName
 * - Deletes ALL temp files if any file fails validation
 */
export async function validateUploadedFiles(req, res, next) {
  try {
    for (const file of req.files) {
      const detected = await fileTypeFromFile(file.path);
      if (!detected) {
        throw ApiError.unsupportedMediaType('File format could not be verified from content bytes');
      }

      const typeInfo = getMediaTypeInfo(detected.mime);
      if (!typeInfo) {
        throw ApiError.unsupportedMediaType(`Unsupported media type detected: ${detected.mime}`);
      }

      if (file.size > typeInfo.maxSizeBytes) {
        throw ApiError.payloadTooLarge(
          `File "${file.originalname}" exceeds maximum permitted size for ${typeInfo.kind}`
        );
      }

      file.detectedKind = typeInfo.kind;
      file.detectedMime = detected.mime;
      file.cloudinaryResourceType = typeInfo.cloudinaryResourceType;
      file.sanitizedName = sanitizeFileName(file.originalname);
    }
    next();
  } catch (err) {
    await cleanupFiles(req.files);
    next(err);
  }
}

