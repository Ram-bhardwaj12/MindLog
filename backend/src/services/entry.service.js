/**
 * Journal Entries Service.
 *
 * Implements business logic for entry CRUD, soft-deletes (trash),
 * restoration, bookmarking, and permanent purging.
 *
 * All operations are strictly scoped to req.user._id.
 * Queries never use .lean() so the Entry model's toJSON transform
 * reliably strips _id, __v, and userId from responses.
 */

import { Entry } from '../models/Entry.js';
import { ApiError } from '../utils/ApiError.js';
import { sanitizeTitle, sanitizeBody } from '../utils/sanitize.js';
import { deleteMediaForEntries } from './mediaCleanup.service.js';

/**
 * Lists all entries for the authenticated user, ordered newest first.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {object} [options]
 * @param {boolean} [options.includeTrash=true] - When false, excludes soft-deleted entries
 * @returns {Promise<Array<import('mongoose').Document>>}
 */
export async function listEntries(userId, { includeTrash = true } = {}) {
  const query = { userId };
  if (!includeTrash) {
    query.deletedAt = null;
  }

  // Never use .lean() - responses must pass through Entry.toJSON()
  return Entry.find(query).sort({ createdAt: -1 });
}

/**
 * Retrieves a single entry by ID for the authenticated user.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} id - Entry ObjectId string
 * @returns {Promise<import('mongoose').Document>}
 */
export async function getEntry(userId, id) {
  const entry = await Entry.findOne({ _id: id, userId });
  if (!entry) {
    throw ApiError.notFound('Entry not found');
  }
  return entry;
}

/**
 * Creates a new journal entry.
 * Sanitizes title and bodyHtml before saving.
 * Accepts an explicit createdAt timestamp for calendar back-dating or planning.
 * Media is initialized to an empty array (handled separately in Phase 5).
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {object} data - Validated create payload
 * @returns {Promise<import('mongoose').Document>}
 */
export async function createEntry(userId, data) {
  const title = data.title !== undefined ? sanitizeTitle(data.title) || 'Untitled entry' : 'Untitled entry';
  const bodyHtml = data.bodyHtml !== undefined ? sanitizeBody(data.bodyHtml) : '';

  const entryData = {
    userId,
    title,
    bodyHtml,
    media: [], // Media cannot be injected here (Phase 5 adds dedicated media endpoints)
    bookmarked: Boolean(data.bookmarked),
  };

  // Optional fields with no invented defaults
  if (data.mood) entryData.mood = data.mood;
  if (data.titleFontStyle) entryData.titleFontStyle = data.titleFontStyle;
  if (data.fontStyle) entryData.fontStyle = data.fontStyle;
  if (data.fontSize) entryData.fontSize = data.fontSize;
  if (data.lineHeight) entryData.lineHeight = data.lineHeight;

  // Preserve explicit creation date if supplied (back-dating or future calendar entry)
  if (data.createdAt) {
    entryData.createdAt = new Date(data.createdAt);
  }

  const entry = new Entry(entryData);
  await entry.save();
  return entry;
}

/**
 * Updates an existing entry's fields.
 * createdAt and media are strictly immutable through this endpoint.
 * Explicit null for optional fields (mood, fonts) clears them ($unset).
 *
 * NOTE on updatedAt: updatedAt follows the legacy PostgreSQL trigger behavior
 * and is updated on every mutation (including bookmarking and trashing).
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} id
 * @param {object} data - Validated update payload
 * @returns {Promise<import('mongoose').Document>}
 */
export async function updateEntry(userId, id, data) {
  const entry = await Entry.findOne({ _id: id, userId });
  if (!entry) {
    throw ApiError.notFound('Entry not found');
  }

  const $set = {};
  const $unset = {};

  if (data.title !== undefined) {
    $set.title = sanitizeTitle(data.title) || 'Untitled entry';
  }
  if (data.bodyHtml !== undefined) {
    $set.bodyHtml = sanitizeBody(data.bodyHtml);
  }
  if (data.bookmarked !== undefined) {
    $set.bookmarked = Boolean(data.bookmarked);
  }

  // Handle optional fields: explicit null unsets, string value sets
  const optionalFields = ['mood', 'titleFontStyle', 'fontStyle', 'fontSize', 'lineHeight'];
  for (const field of optionalFields) {
    if (data[field] === null) {
      $unset[field] = 1;
    } else if (data[field] !== undefined) {
      $set[field] = data[field];
    }
  }

  const updateDoc = {};
  if (Object.keys($set).length > 0) updateDoc.$set = $set;
  if (Object.keys($unset).length > 0) updateDoc.$unset = $unset;

  // If no fields to update, return the existing entry
  if (Object.keys(updateDoc).length === 0) {
    return entry;
  }

  const updatedEntry = await Entry.findOneAndUpdate(
    { _id: id, userId },
    updateDoc,
    { new: true, runValidators: true }
  );

  return updatedEntry;
}

/**
 * Moves an entry to the trash (soft-delete).
 * If already in the trash, preserves the original deletedAt timestamp.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} id
 * @returns {Promise<import('mongoose').Document>}
 */
export async function trashEntry(userId, id) {
  const entry = await Entry.findOne({ _id: id, userId });
  if (!entry) {
    throw ApiError.notFound('Entry not found');
  }

  // If already trashed, do not overwrite the original deletedAt date
  if (entry.deletedAt) {
    return entry;
  }

  entry.deletedAt = new Date();
  await entry.save();
  return entry;
}

/**
 * Restores a soft-deleted entry back to active status.
 * If already active, returns it unchanged.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} id
 * @returns {Promise<import('mongoose').Document>}
 */
export async function restoreEntry(userId, id) {
  const entry = await Entry.findOne({ _id: id, userId });
  if (!entry) {
    throw ApiError.notFound('Entry not found');
  }

  if (!entry.deletedAt) {
    return entry;
  }

  entry.deletedAt = null;
  await entry.save();
  return entry;
}

/**
 * Updates an entry's bookmark status.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} id
 * @param {boolean} bookmarked
 * @returns {Promise<import('mongoose').Document>}
 */
export async function setBookmark(userId, id, bookmarked) {
  const entry = await Entry.findOneAndUpdate(
    { _id: id, userId },
    { $set: { bookmarked: Boolean(bookmarked) } },
    { new: true, runValidators: true }
  );

  if (!entry) {
    throw ApiError.notFound('Entry not found');
  }

  return entry;
}

/**
 * Permanently deletes a single entry from the database.
 * Calls media cleanup hook afterwards.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} id
 * @returns {Promise<{ message: string }>}
 */
export async function deleteEntry(userId, id) {
  const entry = await Entry.findOne({ _id: id, userId });
  if (!entry) {
    throw ApiError.notFound('Entry not found');
  }

  await Entry.deleteOne({ _id: id, userId });

  // Trigger media cleanup hook (Phase 5 Cloudinary integration)
  try {
    await deleteMediaForEntries([entry]);
  } catch {
    console.warn('[Media Cleanup Warning] Background media deletion hook failed for entry.');
  }

  return { message: 'Entry deleted' };
}

/**
 * Purges multiple trashed entries belonging to the authenticated user.
 * Only deletes entries that are currently in the trash (deletedAt !== null).
 * An empty array deletes nothing and returns 0 (never deletes all).
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string[]} ids - Array of ObjectId strings to permanently erase
 * @returns {Promise<number>} Number of deleted entries
 */
export async function purgeTrash(userId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 0;
  }

  // Load matching trashed entries first
  const entries = await Entry.find({
    _id: { $in: ids },
    userId,
    deletedAt: { $ne: null },
  });

  if (entries.length === 0) {
    return 0;
  }

  const targetIds = entries.map((e) => e._id);
  const result = await Entry.deleteMany({
    _id: { $in: targetIds },
    userId,
    deletedAt: { $ne: null },
  });

  // Trigger media cleanup hook
  try {
    await deleteMediaForEntries(entries);
  } catch {
    console.warn('[Media Cleanup Warning] Background media deletion hook failed during purge.');
  }

  return result.deletedCount || entries.length;
}

