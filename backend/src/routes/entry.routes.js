/**
 * Journal Entries API Routes.
 * Mounted at /api/entries.
 *
 * All routes require authentication (requireAuth middleware).
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../validators/validate.js';
import {
  createEntrySchema,
  updateEntrySchema,
  bookmarkEntrySchema,
  purgeTrashSchema,
  listEntriesQuerySchema,
} from '../validators/entry.validators.js';
import * as entryController from '../controllers/entry.controller.js';
import { isValidObjectId } from '../utils/objectId.js';
import { ApiError } from '../utils/ApiError.js';
import {
  loadOwnedActiveEntry,
  uploadMiddleware,
  validateUploadedFiles,
} from '../middleware/upload.js';

const router = Router();

// Enforce authentication across all entry routes
router.use(requireAuth);

/**
 * Middleware that strictly verifies route parameter is a 24-hex ObjectId.
 * Responds 404 NOT_FOUND ("Entry not found") on malformed IDs so attackers
 * cannot distinguish between invalid IDs and non-existent records.
 *
 * @param {string} [paramName='id']
 * @returns {import('express').RequestHandler}
 */
export function validateObjectIdParam(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!isValidObjectId(value)) {
      throw ApiError.notFound(paramName === 'mediaId' ? 'Media not found' : 'Entry not found');
    }
    next();
  };
}

// Validation middleware for query string
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'query',
        message: issue.message,
      }));
      return next(ApiError.validationError('Validation failed', details));
    }
    req.query = result.data;
    next();
  };
}

// --- Collection-level Endpoints ---

// GET /api/entries - List caller's entries
router.get('/', validateQuery(listEntriesQuerySchema), entryController.listEntries);

// POST /api/entries - Create a new entry
router.post('/', validate(createEntrySchema), entryController.createEntry);

// IMPORTANT: Register POST /trash/purge BEFORE any /:id routes.
// If registered after /:id, Express routing would treat "trash" as an :id parameter
// and attempt to match GET /:id or PUT /:id instead of this dedicated purge route.
router.post('/trash/purge', validate(purgeTrashSchema), entryController.purgeTrash);

// --- Individual Entry Endpoints (keyed by :id) ---

// GET /api/entries/:id - Read single entry
router.get('/:id', validateObjectIdParam('id'), entryController.getEntry);

// PUT /api/entries/:id - Update entry
router.put(
  '/:id',
  validateObjectIdParam('id'),
  validate(updateEntrySchema),
  entryController.updateEntry
);

// DELETE /api/entries/:id - Permanent deletion
router.delete('/:id', validateObjectIdParam('id'), entryController.deleteEntry);

// PATCH /api/entries/:id/trash - Soft-delete entry
router.patch('/:id/trash', validateObjectIdParam('id'), entryController.trashEntry);

// PATCH /api/entries/:id/restore - Restore soft-deleted entry
router.patch('/:id/restore', validateObjectIdParam('id'), entryController.restoreEntry);

// PATCH /api/entries/:id/bookmark - Toggle/set bookmark
router.patch(
  '/:id/bookmark',
  validateObjectIdParam('id'),
  validate(bookmarkEntrySchema),
  entryController.setBookmark
);

// --- Media Endpoints (Multer + Cloudinary) ---

// POST /api/entries/:id/media - Upload media attachments (up to 5 files, active entry only)
router.post(
  '/:id/media',
  validateObjectIdParam('id'),
  loadOwnedActiveEntry,
  uploadMiddleware,
  validateUploadedFiles,
  entryController.addMedia
);

// DELETE /api/entries/:id/media/:mediaId - Remove and destroy media attachment
router.delete(
  '/:id/media/:mediaId',
  validateObjectIdParam('id'),
  validateObjectIdParam('mediaId'),
  entryController.removeMedia
);

export default router;

