import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Signs a JSON Web Token containing the user ID subject claim.
 *
 * Security measures:
 * - Explicitly restricts algorithm to HS256 to prevent algorithm confusion.
 * - Expiration is bound to JWT_EXPIRES_DAYS (in seconds).
 *
 * @param {string} userId - User identifier (MongoDB ObjectId string)
 * @returns {string} Signed JWT
 */
export function signAuthToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresInSeconds,
  });
}

/**
 * Verifies a JSON Web Token and extracts its payload.
 *
 * Security measures:
 * - Explicitly enforces algorithms: ['HS256']. Rejects tokens with 'alg: none' or mismatched algorithms.
 * - Throws an error if the token is tampered, expired, or malformed.
 *
 * @param {string} token - Raw JWT string
 * @returns {object} Decoded token payload containing `sub`
 */
export function verifyAuthToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
  });
}

