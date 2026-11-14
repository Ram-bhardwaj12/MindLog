/**
 * Rate Limiting Thresholds and Windows for MindLog API.
 * Central single source of truth for all rate limiting configurations.
 *
 * NOTE ON PROXY ARCHITECTURE:
 * In production, requests flow through Vercel (frontend reverse proxy) to Render (backend host).
 * Client IP identification relies on Express trust-proxy settings matching TRUST_PROXY_HOPS.
 * Rate limit stores are in-memory (per process instance); they reset upon deployment or server restart.
 */

// 1. General API Rate Limiter
// Applied to all /api routes except /api/health to prevent denial-of-service and brute-force traffic.
export const API_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const API_LIMIT_MAX = 1000; // 1000 requests per 15 minutes per client IP

// 2. Authentication Rate Limiter (Per IP)
// Applied to POST /api/auth/login and POST /api/auth/register to throttle credential attacks.
export const AUTH_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const AUTH_LIMIT_MAX = 10; // 10 attempts per 15 minutes per client IP

// 3. Per-Email Login Rate Limiter (Account Takeover Defense)
// Applied to POST /api/auth/login, keyed by SHA-256 hash of normalized email.
// Prevents distributed botnet attacks targeting a single user account across rotating IPs.
// Crucially, it responds identically whether an email exists or not (preventing account enumeration).
export const AUTH_EMAIL_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const AUTH_EMAIL_LIMIT_MAX = 10; // 10 attempts per 15 minutes per email hash

// 4. Per-User Entry Mutation Limiter (Write Throttling)
// Applied to mutating entry routes (POST, PUT, PATCH, DELETE under /api/entries, excluding media upload).
// Keyed strictly by authenticated user ID (never IP) to protect database write IOPS.
export const ENTRY_WRITE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const ENTRY_WRITE_LIMIT_MAX = 200; // 200 write operations per 15 minutes per user

// 5. Per-User Media Upload Limiter (Resource & Bandwidth Throttling)
// Applied to POST /api/entries/:id/media, mounted BEFORE Multer file streaming.
// Keyed strictly by authenticated user ID. Protects temporary disk storage and Cloudinary API quotas.
export const MEDIA_UPLOAD_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const MEDIA_UPLOAD_LIMIT_MAX = 30; // 30 upload requests per hour per user

