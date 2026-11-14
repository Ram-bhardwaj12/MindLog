import mongoose from 'mongoose';

/**
 * Validates whether a value is a valid 24-character hexadecimal MongoDB ObjectId.
 *
 * NOTE: mongoose.isValidObjectId() alone accepts arbitrary 12-byte strings or buffers,
 * which can cause unexpected behavior. This utility enforces that string IDs must match
 * the standard 24-character hex pattern /^[0-9a-fA-F]{24}$/.
 *
 * @param {*} value - Value to test
 * @returns {boolean} True if value is a valid 24-hex string or ObjectId instance
 */
export function isValidObjectId(value) {
  if (!value) {
    return false;
  }

  if (typeof value === 'string') {
    return /^[0-9a-fA-F]{24}$/.test(value) && mongoose.isValidObjectId(value);
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return true;
  }

  return false;
}

