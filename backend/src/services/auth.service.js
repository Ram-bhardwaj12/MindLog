import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import {
  generateResetToken,
  hashResetToken,
  isValidResetTokenFormat,
} from '../utils/resetToken.js';
import { emailClient } from './email/index.js';

// Precomputed dummy bcrypt hash (cost 12) used to mitigate user-enumeration timing attacks.
// If an email does not exist, we still run bcrypt.compare against this dummy hash so
// request response time does not leak account existence.
const DUMMY_HASH = '$2b$12$Kb2tY6h5j6B7v8C9d0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V';

/**
 * Registers a new user account with a hashed password.
 *
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<import('../models/User.js').User>} Created user document
 */
export async function registerUser({ email, password }) {
  // Pre-check for existing user account
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.conflict('Email already registered');
  }

  // Hash password using configured salt rounds
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

  try {
    const user = await User.create({
      email,
      passwordHash,
    });
    return user;
  } catch (err) {
    // Handle concurrent duplicate key race condition
    if (err.code === 11000) {
      throw ApiError.conflict('Email already registered');
    }
    throw err;
  }
}

/**
 * Authenticates user credentials with timing-safe comparison.
 *
 * @param {object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<import('../models/User.js').User>} Authenticated user document
 */
export async function loginUser({ email, password }) {
  // Explicitly include passwordHash (configured with select: false in schema)
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    // Run dummy comparison to protect against user-enumeration timing attacks
    await bcrypt.compare(password, DUMMY_HASH);
    throw ApiError.unauthorized('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  return user;
}

/**
 * Initiates the password reset workflow.
 * Always responds neutrally to protect against user enumeration.
 * If the user exists, previous reset tokens are revoked, a new one is created,
 * and the reset email is dispatched asynchronously.
 *
 * @param {object} params
 * @param {string} params.email
 */
export async function requestPasswordReset({ email }) {
  const user = await User.findOne({ email });

  // If user does not exist, return silently without disclosing account absence
  if (!user) {
    return;
  }

  // Revoke any existing reset tokens for this user
  await PasswordResetToken.deleteMany({ userId: user._id });

  // Generate cryptographically secure token and store SHA-256 hash
  const { token, tokenHash } = generateResetToken();
  const expiresAt = new Date(Date.now() + env.passwordResetTtlMinutes * 60 * 1000);

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  // Dispatch email in the background after the response lifecycle has completed
  setImmediate(async () => {
    try {
      await emailClient.sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        expiresMinutes: env.passwordResetTtlMinutes,
      });
    } catch {
      console.warn('[Email Warning] Failed to dispatch password reset email');
    }
  });
}

/**
 * Resets user password using a single-use token.
 * Uses atomic findOneAndDelete to prevent concurrent token reuse.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.newPassword
 */
export async function resetPassword({ token, newPassword }) {
  // Validate token syntax format before querying database
  if (!isValidResetTokenFormat(token)) {
    throw ApiError.invalidResetToken();
  }

  const tokenHash = hashResetToken(token);
  const now = new Date();

  // Atomically find and consume token (must not be expired).
  // Wrapped in mongoose.trusted() because mongoose.set('sanitizeFilter', true) is enabled globally.
  const resetDoc = await PasswordResetToken.findOneAndDelete(
    mongoose.trusted({
      tokenHash,
      expiresAt: { $gt: now },
    })
  );

  if (!resetDoc) {
    throw ApiError.invalidResetToken();
  }

  const user = await User.findById(resetDoc.userId);
  if (!user) {
    throw ApiError.invalidResetToken();
  }

  // Hash new password using configured bcrypt salt rounds
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

  user.passwordHash = passwordHash;
  user.passwordChangedAt = now;
  await user.save();

  // Revoke all remaining reset tokens for this user
  await PasswordResetToken.deleteMany({ userId: user._id });
}


