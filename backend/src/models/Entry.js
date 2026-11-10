import mongoose from 'mongoose';
import { baseJsonTransform } from '../utils/toJsonOptions.js';

/**
 * Allowed font keys matching MSWordFontKey in src/types.ts and src/components/EntryEditor.tsx
 */
export const VALID_FONTS = [
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
  'journal',
  'handwriting',
  'display',
  'body',
];

/**
 * Allowed font size options matching EntryFontSize in src/types.ts
 */
export const VALID_FONT_SIZES = ['sm', 'base', 'lg', 'xl'];

/**
 * Allowed line height options matching EntryLineHeight in src/types.ts
 */
export const VALID_LINE_HEIGHTS = ['normal', 'relaxed', 'loose'];

/**
 * Allowed media kinds matching MediaKind in src/types.ts
 */
export const VALID_MEDIA_KINDS = ['image', 'video', 'audio'];

/**
 * Embedded Media Sub-schema
 * Stores Cloudinary metadata server-side, but exposes only { id, kind, url, name } to the client.
 */
const MediaSubSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: {
        values: VALID_MEDIA_KINDS,
        message: '{VALUE} is not a supported media kind (must be image, video, or audio)',
      },
      required: [true, 'Media kind is required'],
    },
    url: {
      type: String,
      required: [true, 'Media URL is required'],
      trim: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    publicId: {
      type: String,
      required: [true, 'Cloudinary publicId is required'],
      trim: true,
    },
    resourceType: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    sizeBytes: {
      type: Number,
    },
  },
  {
    _id: true,
    toJSON: {
      transform: (doc, ret) => {
        baseJsonTransform(doc, ret);
        delete ret.publicId;
        delete ret.resourceType;
        delete ret.mimeType;
        delete ret.sizeBytes;
        return ret;
      },
    },
  }
);

/**
 * Entry Schema
 * Represents a private journal entry document.
 */
const EntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    title: {
      type: String,
      default: 'Untitled entry',
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    bodyHtml: {
      type: String,
      default: '',
    },
    media: {
      type: [MediaSubSchema],
      default: [],
    },
    // Optional fields stored only if provided with no invented defaults
    mood: {
      type: String,
      maxlength: [50, 'Mood cannot exceed 50 characters'],
      trim: true,
    },
    titleFontStyle: {
      type: String,
      enum: {
        values: VALID_FONTS,
        message: '{VALUE} is not a valid font style key',
      },
      maxlength: [50, 'Font style cannot exceed 50 characters'],
    },
    fontStyle: {
      type: String,
      enum: {
        values: VALID_FONTS,
        message: '{VALUE} is not a valid font style key',
      },
      maxlength: [50, 'Font style cannot exceed 50 characters'],
    },
    fontSize: {
      type: String,
      enum: {
        values: VALID_FONT_SIZES,
        message: '{VALUE} is not a valid font size (must be sm, base, lg, or xl)',
      },
    },
    lineHeight: {
      type: String,
      enum: {
        values: VALID_LINE_HEIGHTS,
        message: '{VALUE} is not a valid line height (must be normal, relaxed, or loose)',
      },
    },
    bookmarked: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        baseJsonTransform(doc, ret);

        // Never expose internal userId in JSON output
        delete ret.userId;

        // Ensure dates are formatted as ISO strings
        if (ret.createdAt instanceof Date) {
          ret.createdAt = ret.createdAt.toISOString();
        }
        if (ret.updatedAt instanceof Date) {
          ret.updatedAt = ret.updatedAt.toISOString();
        }

        // Omit optional fields that are null or undefined
        if (!ret.deletedAt) {
          delete ret.deletedAt;
        } else if (ret.deletedAt instanceof Date) {
          ret.deletedAt = ret.deletedAt.toISOString();
        }

        if (ret.mood == null) delete ret.mood;
        if (ret.titleFontStyle == null) delete ret.titleFontStyle;
        if (ret.fontStyle == null) delete ret.fontStyle;
        if (ret.fontSize == null) delete ret.fontSize;
        if (ret.lineHeight == null) delete ret.lineHeight;

        // Ensure media items contain exactly { id, kind, url, name }
        if (Array.isArray(ret.media)) {
          ret.media = ret.media.map((item) => {
            const m = typeof item.toJSON === 'function' ? item.toJSON() : item;
            return {
              id: m._id ? m._id.toString() : m.id,
              kind: m.kind,
              url: m.url,
              name: m.name ?? '',
            };
          });
        }

        return ret;
      },
    },
  }
);

/**
 * Compound index:
 * Optimizes the primary query pattern:
 * Entries for a given user, filtering by active/trash state, sorted descending by creation date.
 */
EntrySchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });

export const Entry = mongoose.model('Entry', EntrySchema);
export default Entry;
