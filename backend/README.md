# MindLog Backend API

A modular Node.js + Express backend replacing Supabase for the MindLog personal journaling application.

## 🛠 Tech Stack
- **Runtime**: Node.js (`>=20`, ES Modules)
- **Framework**: Express.js 4 (chosen for stability and compatibility with sanitization middleware; utilizes `asyncHandler` for async error propagation)
- **Database**: MongoDB Atlas with Mongoose 8
- **Validation**: Zod
- **Security & Utilities**: Helmet, CORS with credentials, Cookie-Parser, Morgan, Supertest

---

## 🏛 Architecture Decision: Express 4
The backend is built with **Express 4.22** instead of Express 5:
- **Stability & Ecosystem Compatibility**: Essential security packages like `express-mongo-sanitize` (planned for Phase 8) are fully stable and proven on Express 4.
- **Async Handling**: Express 4 does not automatically forward rejected promises from async handlers to the error middleware. All asynchronous controller functions are therefore wrapped in the shared `asyncHandler` utility (`src/utils/asyncHandler.js`), guaranteeing clean propagation to `errorHandler.js`.

---

## 🗄 Data Models

### 1. `User` (`src/models/User.js`)
- `email`: Required, unique, trimmed, lowercased, max 254 characters.
- `passwordHash`: Required, configured with `select: false` so hashes are never returned by default.
- `toJSON()`: Exposes `id` (string), `email`, and `createdAt`. Strips `passwordHash`, `_id`, and `__v`.

### 2. `Entry` (`src/models/Entry.js`)
- Represents a user's private journal entry.
- `userId`: Required ObjectId referencing `User` (never exposed in API JSON).
- `title`: String, default `'Untitled entry'`, max 200 characters.
- `bodyHtml`: String, default `''`.
- `media`: Embedded subdocuments with `kind` (`image` | `video` | `audio`), `url`, `name`, `publicId` (Cloudinary public ID). In JSON, exposes strictly `{ id, kind, url, name }`.
- `mood`, `titleFontStyle`, `fontStyle`, `fontSize`, `lineHeight`: Optional fields stored only if explicitly provided by the client, with no invented defaults.
- `bookmarked`: Boolean, default `false`.
- `deletedAt`: Date, default `null`. When `null` or undefined, omitted from JSON output.
- **Indexes**: Compound index `{ userId: 1, deletedAt: 1, createdAt: -1 }` optimizing active and trashed entry retrieval sorted by date.


---

## 📋 Prerequisites
- Node.js v20.0.0 or higher
- A MongoDB Atlas account and cluster (or local MongoDB instance)

---

## 🚀 Setup Steps

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your MongoDB Atlas connection string:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/mindlog?retryWrites=true&w=majority
   ```
   *(Ensure your IP is allow-listed under Network Access in MongoDB Atlas)*

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Run the test suite**:
   ```bash
   npm test
   ```

---

## 📜 Available Scripts
- `npm run dev` — Starts the server using Node 20's built-in file watcher (`node --watch`).
- `npm start` — Starts the production server (`node src/server.js`).
- `npm test` — Runs the automated test suite with Node's native test runner (`node --test`).

---

## 🔧 Troubleshooting: Atlas Connection Fails with querySrv Errors

When connecting to MongoDB Atlas using `mongodb+srv://`, Node.js uses `dns.resolveSrv` to query your local network's DNS resolver for cluster shards. Some local ISPs, corporate networks, or Windows configurations reject or block DNS SRV queries with:
`Error: querySrv ECONNREFUSED _mongodb._tcp.cluster0...`

### Solutions:
1. **Opt-in Custom DNS Servers (`DNS_SERVERS`)**:
   Set `DNS_SERVERS` in `backend/.env`:
   ```env
   DNS_SERVERS=8.8.8.8,1.1.1.1
   ```
   This directs Node's `dns.resolve*` queries to Google and Cloudflare DNS specifically for cluster host resolution without modifying system-wide `dns.lookup` calls. It is completely opt-in and not needed in standard Linux cloud environments (e.g. Render).

2. **Atlas Standard (Non-SRV) Connection String**:
   In the MongoDB Atlas dashboard, choose **Database** -> **Connect** -> **Drivers** -> enable **"I am using driver 3.6 or earlier"** (Legacy URI). This generates a direct `mongodb://node1:27017,node2:27017...` seedlist string that requires no SRV resolution.

---

## 📁 Directory Structure
```
backend/
├── .env.example          # Environment variable template with documentation
├── .gitignore            # Ignores node_modules, .env, and logs
├── package.json          # Node.js project manifest and dependencies
├── README.md             # Backend documentation and onboarding guide
├── src/
│   ├── app.js            # Express app configuration, security middleware, and routes
│   ├── server.js         # Entrypoint: loads env, connects to MongoDB, starts HTTP server
│   ├── config/
│   │   ├── env.js        # Zod schema validation for environment variables
│   │   ├── dns.js        # Opt-in custom DNS server configuration for SRV lookups
│   │   └── db.js         # Mongoose Atlas connection and graceful teardown
│   ├── middleware/
│   │   ├── errorHandler.js # Centralized operational and unhandled error handler
│   │   ├── notFound.js   # Universal 404 handler for unmatched routes
│   │   ├── rateLimiter.js# Auth route rate limiter (10 reqs / 15 mins)
│   │   └── requireAuth.js# JWT verification and user authentication middleware
│   ├── routes/
│   │   ├── index.js      # Primary API router mounted at /api
│   │   ├── auth.routes.js# Authentication routes mounted at /api/auth
│   │   ├── entry.routes.js# Journal entry routes mounted at /api/entries
│   │   └── health.routes.js # GET /api/health router
│   ├── controllers/
│   │   ├── auth.controller.js   # Auth action handlers (register, login, logout, me)
│   │   ├── entry.controller.js  # Entry CRUD, trash, restore, bookmark, purge handlers
│   │   └── health.controller.js # Health check status handler
│   ├── models/
│   │   ├── Entry.js      # Mongoose journal entry model with embedded media
│   │   └── User.js       # Mongoose user model with passwordHash and strict toJSON
│   ├── services/
│   │   ├── auth.service.js      # Auth business logic, bcrypt hashing, timing mitigations
│   │   ├── entry.service.js     # Entry CRUD, soft-deletes, restore, bookmark, purge logic
│   │   └── mediaCleanup.service.js # Media deletion placeholder hook (Phase 5)
│   ├── validators/
│   │   ├── auth.validators.js   # Zod validation schemas for register and login
│   │   ├── entry.validators.js  # Zod validation schemas for entry CRUD and purge
│   │   └── validate.js          # Generic Zod request body validation middleware
│   └── utils/
│       ├── ApiError.js   # Standardized operational error class
│       ├── apiResponse.js# Unified API response envelope helper
│       ├── asyncHandler.js# Express 4 async error wrapper
│       ├── cookies.js    # Cookie options builder, setter, and clearer
│       ├── objectId.js   # Strict 24-hex ObjectId validation helper
│       ├── sanitize.js   # HTML & plain-text title sanitization (sanitize-html)
│       ├── toJsonOptions.js# Standardized toJSON transforms for models
│       └── token.js      # JWT sign and verify helpers (HS256 only)
└── tests/
    ├── auth/
    │   ├── auth.test.js         # Integration tests for register, login, logout, me
    │   ├── cookieOptions.test.js# Cookie builder unit tests (dev/prod/SameSite)
    │   ├── csrf.test.js         # CSRF & origin rejection tests
    │   └── rateLimit.test.js    # Rate limiting integration tests
    ├── config/
    │   └── dns.test.js          # DNS_SERVERS parser & setter unit tests
    ├── entries/
    │   ├── entries.test.js      # Integration tests for CRUD, trash, purge, ownership
    │   └── sanitize.test.js     # Unit tests for HTML and plain text sanitization
    ├── models/
    │   ├── entry.test.js        # Entry model schema and toJSON unit tests
    │   ├── user.test.js         # User model schema and toJSON unit tests
    │   └── utils.test.js        # ObjectId and asyncHandler unit tests
    └── health.test.js    # Smoke tests for health endpoint and CORS/Helmet
```

---

## 🔐 Authentication (Phase 3)

MindLog uses server-side JWT authentication delivered exclusively via HttpOnly cookies.

### Cookie Configuration
- **Name**: `mindlog_token` (configurable via `COOKIE_NAME`)
- **HttpOnly**: `true` (prevents access from client-side JavaScript / XSS)
- **SameSite**: `lax` by default (`COOKIE_SAMESITE`), or `none` when running cross-origin over HTTPS
- **Secure**: `true` in production (`NODE_ENV === 'production'` or when `COOKIE_SAMESITE=none`), `false` in development
- **Path**: `/` (valid across all API endpoints)
- **Max-Age**: Derived dynamically from `JWT_EXPIRES_DAYS` (default 7 days: `7 * 24 * 60 * 60 * 1000` ms)
- **Proxy Rationale**: In production, the Vercel frontend proxies `/api/*` to the Render backend, keeping requests first-party (`SameSite: lax` works seamlessly without third-party cookie blocking).

### Security Architecture
- **Password Policy**: Minimum 8 characters, maximum 72 bytes (`Buffer.byteLength(password, 'utf8') <= 72` enforced before bcrypt hashing to prevent DoS and truncation attacks).
- **Password Hashing**: bcrypt with 12 salt rounds in production (`BCRYPT_SALT_ROUNDS`), 4 rounds in test suites for speed.
- **Timing Attack Mitigation**: When login fails due to an unrecognized email, a constant-time dummy bcrypt comparison is executed to eliminate enumeration through response timing differences.
- **JWT Verification**: Strict `HS256` algorithm whitelisting (prevents `alg: "none"` and asymmetric key confusion attacks).
- **CSRF Defense**: State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) with disallowed origins or `Origin: null` are rejected with `403 FORBIDDEN` by CORS middleware before reaching any route handler.
- **Brute-Force Rate Limiting**: Registration and login endpoints are guarded by an in-memory rate limiter configured to 10 requests per 15 minutes per IP.

### Endpoints

#### 1. Register: `POST /api/auth/register`
Creates a new account, sets the auth cookie, and logs the user in immediately.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6730a1b2c3d4e5f6a7b8c9d0",
      "email": "user@example.com",
      "createdAt": "2026-11-10T09:00:00.000Z"
    }
  }
}
```

#### 2. Login: `POST /api/auth/login`
Authenticates existing credentials and sets the auth cookie.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6730a1b2c3d4e5f6a7b8c9d0",
      "email": "user@example.com",
      "createdAt": "2026-11-10T09:00:00.000Z"
    }
  }
}
```

#### 3. Current User: `GET /api/auth/me`
Retrieves the profile of the currently authenticated user based on the cookie.

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6730a1b2c3d4e5f6a7b8c9d0",
      "email": "user@example.com",
      "createdAt": "2026-11-10T09:00:00.000Z"
    }
  }
}
```

#### 4. Logout: `POST /api/auth/logout`
Clears the `mindlog_token` cookie. Always returns 200 (idempotent).

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### Documented Trade-offs
1. **Duplicate Email Conflict (409 CONFLICT)**: Returning a 409 error on registration informs the client that the email is already in use. While this allows email enumeration, it matches standard web application UX (alerting the user to log in instead of create a new account). Login endpoints remain timing-safe and return generic messages.
2. **Stateless JWT Lifetime vs Revocation**: Without a Redis revocation blocklist, tokens remain valid until expiration (7 days). If a user logs out, their client discards the cookie; however, if a token were stolen, it would remain valid until expiry. Password reset token invalidation will be implemented in Phase 7.

---

## 🧪 Manual Verification with Cookie Jars

### Git Bash / Linux / macOS (curl)
```bash
# 1. Register a new user (stores cookie in cookies.txt)
curl -i -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"test@example.com","password":"SecretPassword123"}' \
  -c cookies.txt

# 2. Get current user profile using the stored cookie
curl -i -X GET http://localhost:5000/api/auth/me \
  -H "Origin: http://localhost:5173" \
  -b cookies.txt

# 3. Log out and clear the cookie
curl -i -X POST http://localhost:5000/api/auth/logout \
  -H "Origin: http://localhost:5173" \
  -b cookies.txt \
  -c cookies.txt

# 4. Verify /me fails after logout (401 UNAUTHORIZED)
curl -i -X GET http://localhost:5000/api/auth/me \
  -H "Origin: http://localhost:5173" \
  -b cookies.txt
```

### Windows PowerShell
```powershell
# Create a web request session to persist cookies across requests
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$headers = @{ "Origin" = "http://localhost:5173" }

# 1. Register
$body = @{ email = "test@example.com"; password = "SecretPassword123" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" `
  -Method Post -ContentType "application/json" -Headers $headers -Body $body -WebSession $session

# 2. Check current profile (/me)
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/me" `
  -Method Get -Headers $headers -WebSession $session

# 3. Log out
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/logout" `
  -Method Post -Headers $headers -WebSession $session

# 4. Confirm unauthorized after logout
try {
  Invoke-RestMethod -Uri "http://localhost:5000/api/auth/me" -Method Get -Headers $headers -WebSession $session
} catch {
  Write-Host "Expected 401: $($_.Exception.Message)"
}
```

---

## 📝 Journal Entries API (Phase 4)

All entry routes require an authenticated session (`mindlog_token` HttpOnly cookie) and are strictly scoped to the authenticated caller (`req.user._id`).

### Ownership & Security Rules
- **404 NOT_FOUND for Foreign or Non-Existent Records**: If a client requests, updates, trashes, restores, bookmarks, or deletes an entry belonging to another user (or an entry with an invalid or non-existent ObjectId), the API responds with `404 NOT_FOUND` ("Entry not found"). It never returns 403, preventing resource enumeration.
- **Client-Side Search & No Server Pagination**: In alignment with the React frontend architecture, `GET /api/entries` returns all of the user's entries (sorted newest first by `createdAt`). Search, tag filtering, and sorting occur entirely client-side.
- **Back-Dating Support**: `createdAt` is accepted during entry creation (supporting the calendar picker for past notes and future planning). It is immutable thereafter; update endpoints silently strip `createdAt`.
- **Media Endpoint Separation**: Media attachments cannot be injected via entry endpoints. Entries are created with `media: []`; Phase 5 adds separate multipart media endpoints.

### HTML & Title Sanitization
- **Body HTML**: Sanitized via `sanitize-html` with an explicit allow-list matching the editor's `document.execCommand` outputs (`<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<div>`, `<p>`, `<ul>`, `<ol>`, `<li>`, `<br>`) and safe paste tags (`<h1>-<h6>`, `<blockquote>`, `<pre>`, `<code>`, `<s>`, `<strike>`, `<span>`). Only `text-align: left|center|right|justify` styles are allowed. Disallowed tags are stripped with text preserved; `<script>`, `<style>`, and `<iframe>` are stripped along with their contents.
- **Title**: Plain text only. All HTML tags are stripped, control characters collapsed, and whitespace trimmed.

### Endpoints Table

| Method | Path | Request Body | Success Response | Error Codes |
|---|---|---|---|---|
| `GET` | `/api/entries` | None (Query: `?includeTrash=true\|false`) | `200` `data: { entries: [...] }` | `UNAUTHORIZED` |
| `POST` | `/api/entries` | `{ title?, bodyHtml?, mood?, titleFontStyle?, fontStyle?, fontSize?, lineHeight?, bookmarked?, createdAt? }` | `201` `data: { entry: {...} }` | `VALIDATION_ERROR`, `UNAUTHORIZED` |
| `POST` | `/api/entries/trash/purge` | `{ ids: string[] }` (0-200 valid ObjectIds) | `200` `data: { purgedCount: number }` | `VALIDATION_ERROR`, `UNAUTHORIZED` |
| `GET` | `/api/entries/:id` | None | `200` `data: { entry: {...} }` | `NOT_FOUND`, `UNAUTHORIZED` |
| `PUT` | `/api/entries/:id` | `{ title?, bodyHtml?, mood?, titleFontStyle?, fontStyle?, fontSize?, lineHeight?, bookmarked? }` | `200` `data: { entry: {...} }` | `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED` |
| `PATCH` | `/api/entries/:id/trash` | None | `200` `data: { entry: {...} }` | `NOT_FOUND`, `UNAUTHORIZED` |
| `PATCH` | `/api/entries/:id/restore` | None | `200` `data: { entry: {...} }` | `NOT_FOUND`, `UNAUTHORIZED` |
| `PATCH` | `/api/entries/:id/bookmark` | `{ bookmarked: boolean }` | `200` `data: { entry: {...} }` | `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED` |
| `DELETE` | `/api/entries/:id` | None | `200` `data: { message: "Entry deleted" }` | `NOT_FOUND`, `UNAUTHORIZED` |

### Manual Verification (PowerShell & curl)

#### Windows PowerShell:
```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$headers = @{ "Origin" = "http://localhost:5173" }

# 1. Login
$loginBody = @{ email = "test@example.com"; password = "SecretPassword123" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -ContentType "application/json" -Headers $headers -Body $loginBody -WebSession $session

# 2. Create entry
$entryBody = @{ title = "My First Page"; bodyHtml = "<p>Today was peaceful.</p>"; fontStyle = "calibri" } | ConvertTo-Json
$created = Invoke-RestMethod -Uri "http://localhost:5000/api/entries" -Method Post -ContentType "application/json" -Headers $headers -Body $entryBody -WebSession $session
$id = $created.data.entry.id

# 3. List entries
Invoke-RestMethod -Uri "http://localhost:5000/api/entries" -Method Get -Headers $headers -WebSession $session

# 4. Soft delete (move to trash)
Invoke-RestMethod -Uri "http://localhost:5000/api/entries/$id/trash" -Method Patch -Headers $headers -WebSession $session

# 5. Restore from trash
Invoke-RestMethod -Uri "http://localhost:5000/api/entries/$id/restore" -Method Patch -Headers $headers -WebSession $session

# 6. Purge soft-deleted entries
Invoke-RestMethod -Uri "http://localhost:5000/api/entries/trash/purge" -Method Post -ContentType "application/json" -Headers $headers -Body (@{ ids = @($id) } | ConvertTo-Json) -WebSession $session
```

---

## 📨 API Response Conventions

Every endpoint adheres to a strict uniform response envelope:

### Success Envelope
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation of error",
    "details": []
  }
}
```

### Standard Error Codes
- `BAD_REQUEST`: Malformed request or invalid parameters.
- `VALIDATION_ERROR`: Field-level schema validation errors.
- `UNAUTHORIZED`: Authentication missing or invalid.
- `FORBIDDEN`: User lacks access to the requested resource.
- `NOT_FOUND`: Target resource or route does not exist.
- `CONFLICT`: Unique constraint conflict (e.g. duplicate email).
- `PAYLOAD_TOO_LARGE`: Request body or uploaded file exceeds limits.
- `UNSUPPORTED_MEDIA_TYPE`: Uploaded file format or byte signature is not supported.
- `TOO_MANY_REQUESTS`: Rate limit exceeded.
- `UPLOAD_FAILED`: Upstream Cloudinary media upload or processing failed.
- `INTERNAL_ERROR`: Unexpected internal server error.

---

## 📷 Media API (Multer + Cloudinary)

MindLog supports uploading and attaching images, audio recordings, and videos directly to active journal entries.

### 🔑 Cloudinary Credentials Setup
Add your Cloudinary credentials to `backend/.env`:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
# Optional custom temp upload directory (defaults to <os tmpdir>/mindlog-uploads)
MEDIA_TMP_DIR=
```

### 📋 Allowed Media Types & Limits
File types and kinds are strictly decided from **file content bytes** via `file-type`, never from file extensions or client-supplied MIME headers.

| Kind | Allowed Formats / MIME Types | Max Size | Cloudinary Resource Type |
| :--- | :--- | :--- | :--- |
| **Image** | JPEG (`image/jpeg`), PNG (`image/png`), WebP (`image/webp`), GIF (`image/gif`) | 10 MB | `image` |
| **Audio** | MP3 (`audio/mpeg`), M4A (`audio/x-m4a`, `audio/mp4`), WAV (`audio/wav`), OGG (`audio/ogg`, `application/ogg`) | 20 MB | `video` *(Cloudinary convention)* |
| **Video** | MP4 (`video/mp4`), WebM (`video/webm`), QuickTime / MOV (`video/quicktime`) | 50 MB | `video` |

- **Max Files Per Request**: 5 files (field name: `files`).
- **Max Attachments Per Entry**: 20 attachments total.
- **Unsupported Formats (Explicitly Rejected with 415)**:
  - SVG (rejected due to script execution / XSS vulnerability)
  - HEIC / HEIF, AVIF, BMP, TIFF
  - Note: Audio-only WebM files are identified by container bytes as `video/webm` and classified under video (handled transparently by Cloudinary and HTML5 media players).

### 🛡 Security & Design Rules
1. **Ownership Pre-Check**: The server checks that the target entry exists, belongs to the authenticated caller, and is active (`deletedAt === null`) *before* accepting incoming multipart file streams or writing any bytes to temporary storage.
2. **Byte-Level Validation**: Even if a file is renamed (e.g., `malicious.exe` named `photo.png`), its magic bytes must match an allowed binary signature.
3. **All-or-Nothing Uploads**: If an upload request includes multiple files and any single upload fails, all assets successfully uploaded during that request are immediately rolled back and destroyed from Cloudinary. No partial state is stored in MongoDB.
4. **Race Condition Compensation**: If an entry is soft-deleted or removed mid-upload, uploaded Cloudinary assets are cleaned up immediately and 404 is returned.
5. **Clean Temporary Storage**: Files are streamed to temporary disk storage using random UUID names (never client-provided filenames) and unlinked immediately in a `finally` block on success or failure. An automated sweep at startup deletes any orphaned temp files older than 1 hour.
6. **Background Media Cleanup**: When entries are permanently deleted or purged from the trash, all associated Cloudinary assets are automatically destroyed in batches of 5. Soft-deleting (trashing) an entry preserves media files.

### ⚠️ Known Limitations
- **Public Unguessable Delivery URLs**: Uploaded assets use Cloudinary delivery type `upload`. While URLs contain random UUIDs and folder isolation (`mindlog/{userId}/{entryId}/<uuid>`), anyone with the direct URL can open the media file. This trade-off is required as Cloudinary private signed URLs do not expire dynamically.
- **No Per-User Storage Quotas**: Storage quotas per user are not enforced at the application layer.
- **Rate Limiting**: Rate limits for media endpoints will be configured in Phase 8.
- **Host & Proxy Limits**: When hosted behind proxies (like Vercel rewrites or free-tier hosting), large multipart payloads (e.g., 50MB videos) may encounter platform timeout or body size limitations.

### 🌐 Media Endpoints

#### 1. Upload Media
- **URL**: `POST /api/entries/:id/media`
- **Auth**: Required (`mindlog_token` cookie)
- **Content-Type**: `multipart/form-data`
- **Field**: `files` (up to 5 files)
- **Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "entry": {
      "id": "6730cd2...",
      "title": "My Entry",
      "bodyHtml": "<p>Content</p>",
      "media": [
        {
          "id": "6730ce4...",
          "kind": "image",
          "url": "https://res.cloudinary.com/demo/image/upload/v1/mindlog/.../sample.png",
          "name": "sample.png"
        }
      ],
      "bookmarked": false,
      "createdAt": "2026-11-10T10:00:00.000Z",
      "updatedAt": "2026-11-10T10:05:00.000Z"
    }
  }
}
```

#### 2. Remove Media Attachment
- **URL**: `DELETE /api/entries/:id/media/:mediaId`
- **Auth**: Required (`mindlog_token` cookie)
- **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "entry": {
      "id": "6730cd2...",
      "title": "My Entry",
      "media": [],
      "createdAt": "2026-11-10T10:00:00.000Z",
      "updatedAt": "2026-11-10T10:06:00.000Z"
    }
  }
}
```


