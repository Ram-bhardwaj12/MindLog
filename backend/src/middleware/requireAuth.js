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

    /**
     * Session Invalidation (Phase 7):
     * If the user changed their password, any session tokens issued prior to that password change
     * must be invalidated immediately.
     *
     * Granularity Note:
     * JWT `iat` (issued-at) is stored in whole seconds. We compare `payload.iat` with
     * `Math.floor(user.passwordChangedAt.getTime() / 1000)`. If `payload.iat` is strictly earlier,
     * the session is rejected with generic 401 and the cookie is cleared.
     * Tokens issued within the exact same second as the reset remain technically valid.
     * This 1-second granularity window is standard across JWT implementations and acceptable
     * because password reset requires a multi-step user flow across distinct network requests,
     * and the reset endpoint explicitly clears the active auth cookie on completion.
     */
    if (user.passwordChangedAt && typeof payload.iat === 'number') {
      const passwordChangedSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (payload.iat < passwordChangedSeconds) {
        clearAuthCookie(res);
        return next(ApiError.unauthorized('Authentication required'));
      }
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

