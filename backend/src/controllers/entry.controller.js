/**
 * Journal Entries Controller.
 * Handles HTTP requests for entry listing, retrieval, mutation,
 * soft deletion, restoration, bookmarking, and purging.
 */

import * as entryService from '../services/entry.service.js';
import * as mediaService from '../services/media.service.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/entries
 * Returns all of the authenticated user's entries.
 */
export const listEntries = asyncHandler(async (req, res) => {
  const includeTrash = req.query.includeTrash !== false && req.query.includeTrash !== 'false';
  const entries = await entryService.listEntries(req.user._id, { includeTrash });
  return sendSuccess(res, { entries }, 200);
});

/**
 * GET /api/entries/:id
 * Retrieves a single entry by ID.
 */
export const getEntry = asyncHandler(async (req, res) => {
  const entry = await entryService.getEntry(req.user._id, req.params.id);
  return sendSuccess(res, { entry }, 200);
});

/**
 * POST /api/entries
 * Creates a new journal entry.
 */
export const createEntry = asyncHandler(async (req, res) => {
  const entry = await entryService.createEntry(req.user._id, req.body);
  return sendSuccess(res, { entry }, 201);
});

/**
 * PUT /api/entries/:id
 * Updates an existing journal entry.
 */
export const updateEntry = asyncHandler(async (req, res) => {
  const entry = await entryService.updateEntry(req.user._id, req.params.id, req.body);
  return sendSuccess(res, { entry }, 200);
});

/**
 * PATCH /api/entries/:id/trash
 * Soft-deletes an entry.
 */
export const trashEntry = asyncHandler(async (req, res) => {
  const entry = await entryService.trashEntry(req.user._id, req.params.id);
  return sendSuccess(res, { entry }, 200);
});

/**
 * PATCH /api/entries/:id/restore
 * Restores a soft-deleted entry.
 */
export const restoreEntry = asyncHandler(async (req, res) => {
  const entry = await entryService.restoreEntry(req.user._id, req.params.id);
  return sendSuccess(res, { entry }, 200);
});

/**
 * PATCH /api/entries/:id/bookmark
 * Updates bookmark status on an entry.
 */
export const setBookmark = asyncHandler(async (req, res) => {
  const entry = await entryService.setBookmark(req.user._id, req.params.id, req.body.bookmarked);
  return sendSuccess(res, { entry }, 200);
});

/**
 * DELETE /api/entries/:id
 * Permanently deletes an entry.
 */
export const deleteEntry = asyncHandler(async (req, res) => {
  const result = await entryService.deleteEntry(req.user._id, req.params.id);
  return sendSuccess(res, result, 200);
});

/**
 * POST /api/entries/trash/purge
 * Permanently removes multiple soft-deleted entries.
 */
export const purgeTrash = asyncHandler(async (req, res) => {
  const purgedCount = await entryService.purgeTrash(req.user._id, req.body.ids);
  return sendSuccess(res, { purgedCount }, 200);
});

/**
 * POST /api/entries/:id/media
 * Uploads and attaches up to 5 media files to an active entry.
 */
export const addMedia = asyncHandler(async (req, res) => {
  const entry = await mediaService.addMediaToEntry(req.user._id, req.entry, req.files);
  return sendSuccess(res, { entry }, 201);
});

/**
 * DELETE /api/entries/:id/media/:mediaId
 * Detaches and destroys a media attachment from an active entry.
 */
export const removeMedia = asyncHandler(async (req, res) => {
  const entry = await mediaService.removeMediaFromEntry(
    req.user._id,
    req.params.id,
    req.params.mediaId
  );
  return sendSuccess(res, { entry }, 200);
});


