import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env if present
dotenv.config();

/**
 * Parses and validates an optional comma-separated list of IP addresses.
 * Trims whitespace, ignores empty entries, and parses to an array of strings
 * or undefined when unset or empty.
 *
 * @param {string|undefined|null} raw
 * @returns {string[]|undefined}
 * @throws {Error} if any entry is not a valid IPv4 or IPv6 address
 */
export function parseDnsServers(raw) {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') {
    throw new Error('DNS_SERVERS must be a string');
  }

  const trimmed = raw.trim();
  if (trimmed === '') return undefined;

  const entries = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (entries.length === 0) return undefined;

  for (const entry of entries) {
    if (!net.isIP(entry)) {
      throw new Error(`Invalid IP address in DNS_SERVERS: "${entry}"`);
    }
  }

  return entries;
}

/**
 * Zod schema defining the backend configuration contract.
 * Fails fast on startup if required variables are missing or malformed.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().trim().min(1, 'MONGODB_URI is required').optional(),
    CLIENT_ORIGINS: z.string().trim().min(1, 'CLIENT_ORIGINS cannot be empty').optional(),

    // --- Reverse Proxy Hops (Phase 8 & 9) ---
    // Number of reverse proxy hops in front of the Express app (0 to 5, default 1).
    // In production behind Vercel + Render, this must align with the exact hop count.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0, 'TRUST_PROXY_HOPS must be between 0 and 5').max(5, 'TRUST_PROXY_HOPS must be between 0 and 5').default(1),

    // --- Optional DNS Workaround for SRV resolution ---
    DNS_SERVERS: z.string().optional(),

    // --- Authentication (Phase 3) ---
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
    JWT_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
    COOKIE_NAME: z.string().trim().min(1).default('mindlog_token'),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    BCRYPT_SALT_ROUNDS: z.coerce
      .number()
      .int()
      .min(4, 'BCRYPT_SALT_ROUNDS must be at least 4')
      .default(12),

    // --- Cloudinary & Media Uploads (Phase 5) ---
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    MEDIA_TMP_DIR: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // MONGODB_URI is required when running the server, but omitted during automated tests
    if (data.NODE_ENV !== 'test' && (!data.MONGODB_URI || data.MONGODB_URI.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGODB_URI'],
        message: 'MONGODB_URI is required when running the server (check your .env file)',
      });
    }

    // JWT_SECRET is required when running the server in development or production
    if (data.NODE_ENV !== 'test' && (!data.JWT_SECRET || data.JWT_SECRET.length < 32)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be defined with at least 32 characters (check your .env file)',
      });
    }

    // Production-specific hardening validations (Phase 8)
    if (data.NODE_ENV === 'production') {
      // 1. CLIENT_ORIGINS must be set explicitly, must not contain localhost, and must use HTTPS
      if (!data.CLIENT_ORIGINS || data.CLIENT_ORIGINS.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLIENT_ORIGINS'],
          message: 'CLIENT_ORIGINS must be set explicitly in production (check your environment)',
        });
      } else {
        const origins = data.CLIENT_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
        if (origins.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CLIENT_ORIGINS'],
            message: 'CLIENT_ORIGINS must contain at least one valid origin',
          });
        }
        for (const origin of origins) {
          if (origin.toLowerCase().includes('localhost')) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['CLIENT_ORIGINS'],
              message: 'CLIENT_ORIGINS must not contain localhost in production',
            });
          }
          if (!origin.startsWith('https://')) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['CLIENT_ORIGINS'],
              message: `Origin "${origin}" must start with https:// in production`,
            });
          }
        }
      }

      // 2. JWT_SECRET cannot be an obvious placeholder
      if (data.JWT_SECRET) {
        const lowerSecret = data.JWT_SECRET.toLowerCase();
        const isPlaceholder =
          lowerSecret.includes('your_') ||
          lowerSecret.includes('changeme') ||
          lowerSecret === 'secret' ||
          lowerSecret === 'your_minimum_32_characters_long_jwt_secret_here';

        if (isPlaceholder) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET must not use a known template placeholder in production',
          });
        }
      }
    } else {
      // Non-production default for CLIENT_ORIGINS if omitted
      if (!data.CLIENT_ORIGINS || data.CLIENT_ORIGINS.trim() === '') {
        data.CLIENT_ORIGINS = 'http://localhost:5173';
      }
    }

    // Cloudinary credentials required when running the server in development or production
    if (data.NODE_ENV !== 'test') {
      if (!data.CLOUDINARY_CLOUD_NAME || data.CLOUDINARY_CLOUD_NAME.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLOUDINARY_CLOUD_NAME'],
          message: 'CLOUDINARY_CLOUD_NAME is required (check your .env file)',
        });
      }
      if (!data.CLOUDINARY_API_KEY || data.CLOUDINARY_API_KEY.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLOUDINARY_API_KEY'],
          message: 'CLOUDINARY_API_KEY is required (check your .env file)',
        });
      }
      if (!data.CLOUDINARY_API_SECRET || data.CLOUDINARY_API_SECRET.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLOUDINARY_API_SECRET'],
          message: 'CLOUDINARY_API_SECRET is required (check your .env file)',
        });
      }
    }

    // Validate optional DNS_SERVERS if defined
    if (data.DNS_SERVERS !== undefined) {
      try {
        parseDnsServers(data.DNS_SERVERS);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DNS_SERVERS'],
          message: err.message,
        });
      }
    }
  });

/**
 * Validates environment configuration against envSchema.
 * Never prints secret values to the terminal.
 *
 * @param {object} [input=process.env] - Environment dictionary to validate
 * @param {boolean} [exitOnError=true] - Whether to exit process on error (false in test harnesses)
 * @returns {object} Validated and derived environment settings
 */
export function validateEnv(input = process.env, exitOnError = true) {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    if (exitOnError) {
      console.error('====================================================');
      console.error('[FATAL] Environment variable validation failed:');
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || 'configuration';
        console.error(`  - ${field}: ${issue.message}`);
      }
      console.error('====================================================');
      process.exit(1);
    } else {
      const error = new Error('Environment variable validation failed');
      error.issues = result.error.issues;
      throw error;
    }
  }

  const data = result.data;
  const parsedDnsServers = parseDnsServers(data.DNS_SERVERS);

  // Single source of truth for token and cookie lifespan:
  // Derived directly from JWT_EXPIRES_DAYS so they cannot drift apart.
  const cookieMaxAgeMs = data.JWT_EXPIRES_DAYS * 24 * 60 * 60 * 1000;
  const jwtExpiresInSeconds = data.JWT_EXPIRES_DAYS * 24 * 60 * 60;

  // If SameSite is 'none', Secure must be forced true (browsers reject SameSite=None without Secure)
  const isCookieSecure = data.NODE_ENV === 'production' || data.COOKIE_SAMESITE === 'none';

  // Temporary storage directory for multipart media uploads
  const mediaTmpDir = data.MEDIA_TMP_DIR
    ? path.resolve(data.MEDIA_TMP_DIR)
    : path.join(os.tmpdir(), 'mindlog-uploads');

  const rawOrigins = data.CLIENT_ORIGINS || 'http://localhost:5173';
  const clientOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);

  return {
    ...data,
    TRUST_PROXY_HOPS: data.TRUST_PROXY_HOPS,
    trustProxyHops: data.TRUST_PROXY_HOPS,
    DNS_SERVERS: parsedDnsServers,
    dnsServers: parsedDnsServers,
    mediaTmpDir,
    MEDIA_TMP_DIR: mediaTmpDir,
    cookieMaxAgeMs,
    jwtExpiresInSeconds,
    isCookieSecure,
    clientOrigins,
    isProduction: data.NODE_ENV === 'production',
    isTest: data.NODE_ENV === 'test',
  };
}

export const env = validateEnv();
