import {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword as resetPasswordService,
} from '../services/auth.service.js';
import { signAuthToken } from '../utils/token.js';
import { setAuthCookie, clearAuthCookie } from '../utils/cookies.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Register a new user account.
 * Logs the user in immediately upon successful registration.
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await registerUser({ email, password });

  const token = signAuthToken(user._id.toString());
  setAuthCookie(res, token);

  return sendSuccess(res, { user: user.toJSON() }, 201);
});

/**
 * Authenticate existing user with email and password.
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await loginUser({ email, password });

  const token = signAuthToken(user._id.toString());
  setAuthCookie(res, token);

  return sendSuccess(res, { user: user.toJSON() }, 200);
});

/**
 * Log out user by clearing the authentication cookie.
 * Idempotent: does not require prior authentication and always succeeds.
 */
export const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  return sendSuccess(res, { message: 'Logged out' }, 200);
});

/**
 * Return current authenticated user profile.
 */
export const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, { user: req.user.toJSON() }, 200);
});

/**
 * Handle password reset request.
 * Always returns 200 with an identical neutral message to protect against user enumeration.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await requestPasswordReset({ email });

  return sendSuccess(
    res,
    { message: 'If an account exists for that email, a reset link has been sent.' },
    200
  );
});

/**
 * Complete password reset using token and new password.
 * Clears any active authentication cookie and returns 200 without logging the user in.
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  await resetPasswordService({ token, newPassword });

  clearAuthCookie(res);
  return sendSuccess(res, { message: 'Password updated. Please sign in.' }, 200);
});


