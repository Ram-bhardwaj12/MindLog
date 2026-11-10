import { env } from '../config/env.js';

/**
 * Builds the cookie options object based on current environment settings.
 * Exposed for unit testing and consistent cookie attribute management.
 *
 * @param {boolean} [forClear=false] - If true, omits maxAge for clearing
 * @returns {import('express').CookieOptions} Cookie options
 */
export function getAuthCookieOptions(forClear = false) {
  const options = {
    httpOnly: true,
    secure: env.isCookieSecure,
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
  };

  if (!forClear) {
    options.maxAge = env.cookieMaxAgeMs;
  }

  return options;
}

/**
 * Sets the HttpOnly authentication cookie containing the JWT.
 *
 * @param {import('express').Response} res - Express response object
 * @param {string} token - Signed JWT string
 */
export function setAuthCookie(res, token) {
  res.cookie(env.COOKIE_NAME, token, getAuthCookieOptions(false));
}

/**
 * Clears the authentication cookie from the client.
 *
 * NOTE: clearCookie MUST specify the exact same path ('/'), secure, and sameSite
 * attributes as setCookie; otherwise, RFC 6265 compliant browsers will fail to
 * delete the stored cookie.
 *
 * @param {import('express').Response} res - Express response object
 */
export function clearAuthCookie(res) {
  res.clearCookie(env.COOKIE_NAME, getAuthCookieOptions(true));
}

