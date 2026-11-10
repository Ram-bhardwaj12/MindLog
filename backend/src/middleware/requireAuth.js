import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAuthToken } from '../utils/token.js';
import { isValidObjectId } from '../utils/objectId.js';
import { clearAuthCookie } from '../utils/cookies.js';

/**
 * Authentication middleware.
 * Verifies the mindlog_token cookie and populates req.user.
 *
 * Security measures:
 * - On ANY failure (missing, invalid signature, expired, user deleted),
 *   clears any present cookie and returns a generic 401 "Authentication required"
 *   to avoid leaking internal verification details.
 */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[env.COOKIE_NAME];

  if (!token) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  try {
    const payload = verifyAuthToken(token);

    if (!payload.sub || !isValidObjectId(payload.sub)) {
      clearAuthCookie(res);
      return next(ApiError.unauthorized('Authentication required'));
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      clearAuthCookie(res);
      return next(ApiError.unauthorized('Authentication required'));
    }

    // Attach user document to request context
    req.user = user;
    next();
  } catch (err) {
    // Clear invalid/expired cookie on client
    clearAuthCookie(res);
    return next(ApiError.unauthorized('Authentication required'));
  }
}

