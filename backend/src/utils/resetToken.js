import crypto from 'node:crypto';

/**
 * Strict regex for 32-byte base64url-encoded tokens without padding (exactly 43 characters).
 */
export const RESET_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

/**
 * Validates whether an incoming token string strictly matches the base64url format.
 *
 * @param {unknown} token
 * @returns {boolean} True if string is exactly 43 valid base64url characters
 */
export function isValidResetTokenFormat(token) {
  return typeof token === 'string' && RESET_TOKEN_REGEX.test(token);
}

/**
 * Hashes a plaintext reset token using SHA-256 into a 64-character hexadecimal digest.
 *
 * @param {string} token
 * @returns {string} SHA-256 hex string
 */
export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a cryptographically secure 32-byte random reset token and its SHA-256 digest.
 *
 * @returns {{ token: string, tokenHash: string }}
 */
export function generateResetToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(token);
  return { token, tokenHash };
}
