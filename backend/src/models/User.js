import mongoose from 'mongoose';
import { baseJsonTransform } from '../utils/toJsonOptions.js';

/**
 * User Model
 * Represents an account in MindLog.
 * Password hashing with bcrypt is added in Phase 3.
 */
const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email cannot exceed 254 characters'],
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Omitted by default from query results
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        baseJsonTransform(doc, ret);

        // Ensure sensitive credentials are never exposed in JSON output
        delete ret.passwordHash;

        if (ret.createdAt instanceof Date) {
          ret.createdAt = ret.createdAt.toISOString();
        }
        if (ret.updatedAt instanceof Date) {
          ret.updatedAt = ret.updatedAt.toISOString();
        }

        return ret;
      },
    },
  }
);

export const User = mongoose.model('User', UserSchema);
export default User;
