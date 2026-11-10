import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

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

