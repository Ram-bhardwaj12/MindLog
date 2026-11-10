import { z } from 'zod';

/**
 * Register validation schema
 * Enforces email syntax and password length (min 8 chars, max 72 bytes).
 * bcrypt silently ignores bytes beyond 72, so byte-length validation is critical.
 */
export const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address')
    .max(254, 'Email cannot exceed 254 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .refine((val) => Buffer.byteLength(val, 'utf8') <= 72, {
      message: 'Password cannot exceed 72 bytes',
    }),
});

/**
 * Login validation schema
 * Validates presence of credentials without exposing password policy rules.
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
    .max(128, 'Password exceeds maximum length'),
});

