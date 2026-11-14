/**
 * Zod validation schemas for journal entry endpoints.
 *
 * Enforces strict allow-lists preventing mass assignment attacks.
 * Unrecognized fields (e.g. userId, _id, media, deletedAt, updatedAt)
 * are stripped during parsing and never passed to services or Mongoose.
 */

import { z } from 'zod';
import { isValidObjectId } from '../utils/objectId.js';

/**
 * 16 Microsoft Word-inspired typography options supported by MindLog.
 * Mirrors MSWordFontKey in src/types.ts.
 */
export const MS_WORD_FONT_KEYS = [
  'calibri',
  'georgia',
  'times',
  'garamond',
  'arial',
  'comic',
  'courier',
  'verdana',
  'trebuchet',
  'impact',
  'palatino',
  'bookman',
  'handwriting',
  'journal',
  'display',
  'body',
];

/**
 * Typography size presets. Mirrors EntryFontSize in src/types.ts.
 */
export const ENTRY_FONT_SIZES = ['sm', 'base', 'lg', 'xl'];

/**
 * Typography line height presets. Mirrors EntryLineHeight in src/types.ts.
 */
export const ENTRY_LINE_HEIGHTS = ['normal', 'relaxed', 'loose'];

/**
 * Validates an ISO date string falls between 1900-01-01 and 2100-01-01.
 * Supports calendar back-dating and future planning.
 */
const dateRangeValidator = z
  .string({ invalid_type_error: 'createdAt must be an ISO date string' })
  .refine((val) => !isNaN(Date.parse(val)), {
    message: 'createdAt must be a valid date',
  })
  .refine(
    (val) => {
      const d = new Date(val);
      const min = new Date('1900-01-01T00:00:00.000Z');
      const max = new Date('2100-01-01T00:00:00.000Z');
      return d >= min && d <= max;
    },
    { message: 'createdAt must be a valid date between 1900-01-01 and 2100-01-01' }
  );

/**
 * Schema for POST /api/entries (create entry).
 * Media is stripped/ignored (handled independently in Phase 5).
 */
export const createEntrySchema = z.object({
  title: z
    .string({ invalid_type_error: 'title must be a string' })
    .max(200, 'Title cannot exceed 200 characters')
    .optional(),
  bodyHtml: z
    .string({ invalid_type_error: 'bodyHtml must be a string' })
    .max(200000, 'Body HTML cannot exceed 200,000 characters')
    .optional(),
  mood: z.string().max(50, 'Mood cannot exceed 50 characters').nullable().optional(),
  titleFontStyle: z.enum(MS_WORD_FONT_KEYS).nullable().optional(),
  fontStyle: z.enum(MS_WORD_FONT_KEYS).nullable().optional(),
  fontSize: z.enum(ENTRY_FONT_SIZES).nullable().optional(),
  lineHeight: z.enum(ENTRY_LINE_HEIGHTS).nullable().optional(),
  bookmarked: z.boolean({ invalid_type_error: 'bookmarked must be a boolean' }).optional(),
  createdAt: dateRangeValidator.optional(),
});

/**
 * Schema for PUT /api/entries/:id (update entry).
 * Explicitly excludes createdAt (immutable after creation) and media (Phase 5).
 * Explicit null for optional fields (mood, font fields) clears them.
 */
export const updateEntrySchema = z.object({
  title: z
    .string({ invalid_type_error: 'title must be a string' })
    .max(200, 'Title cannot exceed 200 characters')
    .optional(),
  bodyHtml: z
    .string({ invalid_type_error: 'bodyHtml must be a string' })
    .max(200000, 'Body HTML cannot exceed 200,000 characters')
    .optional(),
  mood: z.string().max(50, 'Mood cannot exceed 50 characters').nullable().optional(),
  titleFontStyle: z.enum(MS_WORD_FONT_KEYS).nullable().optional(),
  fontStyle: z.enum(MS_WORD_FONT_KEYS).nullable().optional(),
  fontSize: z.enum(ENTRY_FONT_SIZES).nullable().optional(),
  lineHeight: z.enum(ENTRY_LINE_HEIGHTS).nullable().optional(),
  bookmarked: z.boolean({ invalid_type_error: 'bookmarked must be a boolean' }).optional(),
});

/**
 * Schema for PATCH /api/entries/:id/bookmark.
 * Requires a strict boolean.
 */
export const bookmarkEntrySchema = z.object({
  bookmarked: z.boolean({
    required_error: 'bookmarked is required and must be a boolean',
    invalid_type_error: 'bookmarked must be a boolean',
  }),
});

/**
 * Schema for POST /api/entries/trash/purge.
 * Accepts an array of 0-200 valid ObjectId strings; removes duplicates.
 */
export const purgeTrashSchema = z.object({
  ids: z
    .array(
      z.string({ invalid_type_error: 'Each ID must be a string' }).refine(
        (val) => isValidObjectId(val),
        { message: 'Each ID must be a valid 24-character hexadecimal ObjectId' }
      ),
      { required_error: 'ids array is required' }
    )
    .max(200, 'Cannot purge more than 200 entries at once')
    .transform((ids) => [...new Set(ids)]),
});

/**
 * Schema for GET /api/entries query parameters.
 * Defaults includeTrash to true, matching the original fetchEntries behaviour.
 */
export const listEntriesQuerySchema = z.object({
  includeTrash: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((val) => {
      if (val === undefined) return true;
      if (typeof val === 'boolean') return val;
      return val === 'true';
    }),
});

