import mongoose from 'mongoose';

/**
 * PasswordResetToken Model.
 *
 * Stores SHA-256 hashed password reset tokens with an automatic TTL expiration index.
 * Plaintext reset tokens are never stored in the database.
 */
const PasswordResetTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      expires: 0, // MongoDB TTL index: documents are automatically purged when expiresAt <= now
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const PasswordResetToken = mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
export default PasswordResetToken;
