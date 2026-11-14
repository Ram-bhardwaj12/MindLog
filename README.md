# Digital Journal App (MindLog) 📖

🚀 **Live Site:** [https://mind-log-smoky.vercel.app](https://mind-log-smoky.vercel.app)

---

## 📌 Project & Intern Details

| Information | Details |
| :--- | :--- |
| **Intern Name** | Ram Bhardwaj |
| **Intern ID** | `CITS7926` |
| **Project Name** | Digital Journal App (MindLog) |
| **Duration** | 4 Weeks |
| **Live Demo** | [https://mind-log-smoky.vercel.app](https://mind-log-smoky.vercel.app) |

---

## 🎯 Project Overview & Scope

The **Digital Journal App (MindLog)** is a personal journaling web application crafted to provide users with a private, seamless, and aesthetically engaging space to document daily thoughts, track moods, and save rich multimedia memories.

MindLog features a decoupled, production-grade architecture: a reactive **React + TypeScript + Vite** frontend and an enterprise-grade **Node.js + Express 4 + MongoDB Atlas** RESTful backend with **Cloudinary** media management.

### 🌟 Core Features

1. **Authentication & Session Security**:
   - Secure Sign-up, Sign-in, Session Persistence (`/api/auth/me`), and Logout.
   - Stateless authentication via **JWT delivered in HttpOnly, SameSite=Lax** cookies (`mindlog_token`), neutralizing token-theft XSS.
   - Password hashing with **bcrypt** (12 salt rounds) with dummy timing-attack mitigations for non-existent users.
   - Multi-tier rate limiting via `express-rate-limit` v8 (General API, Per-IP Auth, Per-Email Login, Per-User Write, and Per-User Media Upload limiters).

2. **Rich Entry Editor & Customization**:
   - Rich creation/editing modal for drafting titles, rich body text, mood tracking, and attachments.
   - Formatting support: bold, italic, underline, text alignment (left, center, right, justify), and bulleted/numbered lists.
   - Real-time **Title Font** and **Body Font** customization across 12 typography options (including *Lora*, *Fraunces*, *Caveat*, *Comic Sans MS*, *Garamond*, and *SF Pro*), with custom font-size and line-height controls.
   - HTML sanitization using `sanitize-html` to prevent stored XSS, and tag-stripping title normalization that preserves plain entities (`&`, `"`, `<`, `>`) with guaranteed idempotence.

3. **Multi-Format Multimedia Attachments**:
   - Direct integration with **Cloudinary** supporting images (JPEG, PNG, WebP, GIF), audio recordings (MP3, M4A, WAV, OGG) with inline players, and video clips (MP4, WebM, MOV).
   - Strict server-side **binary magic-byte inspection** (`file-type`), ensuring files match declared formats regardless of spoofed extensions. SVGs are rejected to eliminate script execution risks.
   - Atomic rollback: if any file in a multi-file upload fails, all uploaded assets in that batch are destroyed immediately.
   - Automated remote asset destruction on Cloudinary when entries are permanently deleted or purged.

4. **Multi-View Journal Dashboard**:
   - **Grid Cards View**: Responsive cards displaying entry summaries, mood indicators, bookmark status, and attachment counts.
   - **Timeline View**: Chronological vertical feed grouped by months with expandable rich media and datelines.
   - **Interactive Calendar View**: Calendar matrix mapping entries to specific dates, with full support for date filtering and timezone-safe past back-dating (local noon normalization).
   - **Recycle Bin (Trash)**: Two-stage deletion lifecycle featuring soft-deleting, instant restoration, and permanent batch purging.

---

## 🏗️ Architecture Overview

MindLog utilizes a first-party proxy architecture for production deployment:

```mermaid
flowchart TD
    subgraph Client ["Client Browser"]
        SPA["React SPA (http://localhost:5173 or mind-log-smoky.vercel.app)"]
    end

    subgraph VercelEdge ["Vercel Edge Platform"]
        Static["Static Assets Hosting (HTML, CSS, JS)"]
        ProxyRewrite["Vercel Proxy Rewrite: /api/* -> Render Backend"]
    end

    subgraph RenderBackend ["Render Cloud Web Service"]
        ExpressApp["Express 4 REST API (Node.js 20+)"]
        Security["Security: Helmet, CORS, RateLimiters, rejectOperatorKeys"]
    end

    subgraph CloudServices ["External Cloud Services"]
        MongoAtlas[("MongoDB Atlas (Database)")]
        Cloudinary["Cloudinary CDN (Media Storage)"]
    end

    SPA -->|"1. Load Static Files"| Static
    SPA -->|"2. API Calls (/api/* with HttpOnly Cookie)"| ProxyRewrite
    ProxyRewrite -->|"3. Forwarded Request (X-Forwarded-For: Client, Vercel)"| ExpressApp
    ExpressApp -->|"Security Hardening & Validation"| Security
    Security -->|"Queries & Mutations"| MongoAtlas
    Security -->|"Magic-Byte Uploads & Remote Purge"| Cloudinary
```

### Why the Proxy Architecture?
In production, the frontend on Vercel rewrites `/api/*` requests directly to the Render backend. Because requests originate from the same domain as the website, the auth cookie (`mindlog_token`) is treated as a **first-party cookie**. This enables `SameSite=Lax` cookie protection without relying on fragile third-party cookie handling.

---

## 💻 Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Custom CSS Cascade Variables
- **Icons**: Lucide React
- **Typography**: Google Fonts (*Fraunces*, *Lora*, *Caveat*, *Comic Neue*, *Courier Prime*, *EB Garamond*, *Work Sans*, *Inter*, *IBM Plex Mono*)
- **Deployment**: Vercel

### Backend API
- **Runtime**: Node.js (`>=20`, native ES Modules)
- **Framework**: Express.js 4 (utilizing centralized `asyncHandler` error propagation)
- **Database & ODM**: MongoDB Atlas with Mongoose 8
- **Media CDN & Storage**: Cloudinary SDK + Multer (streamed with UUID isolation)
- **Input Validation**: Zod 3
- **Security Middleware**: Helmet 8, CORS with origin allow-list, Cookie-Parser, express-rate-limit 8, sanitize-html
- **Automated Testing**: Node.js native test runner (`node --test`), `mongodb-memory-server`, `supertest` (**178 automated tests, 57 suites, 0 failures**)

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- **Node.js** v20.0.0 or higher
- A **MongoDB Atlas** account and cluster (or local MongoDB)
- A **Cloudinary** account (for image, audio, and video storage)

### 2. Clone the Repository
```bash
git clone https://github.com/Ram-bhardwaj12/MindLog.git
cd MindLog
```

### 3. Backend Setup (Terminal 1)
1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Create your local environment file from the example template:
   ```bash
   cp .env.example .env
   ```
3. Open `backend/.env` and supply your database and Cloudinary credentials:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/mindlog?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
   JWT_EXPIRES_DAYS=7
   COOKIE_NAME=mindlog_token
   COOKIE_SAMESITE=lax
   CLIENT_ORIGINS=http://localhost:5173
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   TRUST_PROXY_HOPS=1
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   *(Server starts with live watcher on `http://localhost:5000`; health check available at `http://localhost:5000/api/health`)*

5. Run automated tests (178 tests):
   ```bash
   npm test
   ```

### 4. Frontend Setup (Terminal 2)
1. From the repository root, install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser exactly at:
   ```
   http://localhost:5173
   ```
   *(Vite automatically proxies all `/api/*` calls to the local backend at `http://localhost:5000` via `vite.config.ts`)*

---

## 🔑 Environment Variables Overview

All environment variables used by the backend are validated at boot time via Zod in `backend/src/config/env.js`. For a complete template with documentation, inspect `backend/.env.example`.

| Variable | Required? | Example Placeholder | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Optional | `development` | Set to `production` in production deployment or `test` in test suites. |
| `PORT` | Optional | `5000` | HTTP port to listen on. Render automatically supplies this in production. |
| `MONGODB_URI` | **Required** | `mongodb+srv://user:pass@cluster0.mongodb.net/mindlog` | MongoDB Atlas connection string. |
| `JWT_SECRET` | **Required** | `a_random_40_char_high_entropy_secret_key` | Secret used to sign authentication JWTs (minimum 32 characters). |
| `JWT_EXPIRES_DAYS`| Optional | `7` | Lifespan of auth tokens and HttpOnly cookies in days (default 7). |
| `COOKIE_NAME` | Optional | `mindlog_token` | Name of the authentication cookie. |
| `COOKIE_SAMESITE` | Optional | `lax` | SameSite cookie policy (`lax`, `strict`, or `none`). Stays `lax` behind proxy. |
| `CLIENT_ORIGINS` | **Required in Prod** | `https://mind-log-smoky.vercel.app` | Comma-separated allowed frontend origins. In prod, must use HTTPS and omit localhost. |
| `CLOUDINARY_CLOUD_NAME` | **Required** | `your_cloud_name` | Cloudinary account cloud name. |
| `CLOUDINARY_API_KEY` | **Required** | `123456789012345` | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | **Required** | `your_cloudinary_api_secret` | Cloudinary API secret. |
| `TRUST_PROXY_HOPS` | Optional | `1` (Dev) / `2` (Prod) | Number of reverse proxy hops in front of Express (Vercel -> Render = 2). |
| `DNS_SERVERS` | Local Only | `8.8.8.8,1.1.1.1` | Custom DNS resolvers for local Windows SRV lookup issues. **Do NOT set in production.** |

---

## 📡 API Overview

The backend exposes a RESTful API returning standardized envelopes:
- **Success Envelope**: `{ "success": true, "data": { ... } }`
- **Error Envelope**: `{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }`

| Route | Method | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | Health status and uptime | No |
| `/api/auth/register` | `POST` | Create account and issue cookie | No (Rate Limited) |
| `/api/auth/login` | `POST` | Authenticate and issue cookie | No (Rate Limited) |
| `/api/auth/logout` | `POST` | Clear auth cookie | No |
| `/api/auth/me` | `GET` | Retrieve authenticated user profile | **Yes** |
| `/api/entries` | `GET` | List user entries (`?includeTrash=true\|false`) | **Yes** |
| `/api/entries` | `POST` | Create a new journal entry | **Yes** (Rate Limited) |
| `/api/entries/:id` | `GET` | Retrieve single entry by ID | **Yes** |
| `/api/entries/:id` | `PUT` | Update an existing journal entry | **Yes** (Rate Limited) |
| `/api/entries/:id` | `DELETE` | Permanently erase single entry | **Yes** (Rate Limited) |
| `/api/entries/:id/trash` | `PATCH` | Soft-delete entry (move to trash) | **Yes** (Rate Limited) |
| `/api/entries/:id/restore` | `PATCH` | Restore soft-deleted entry | **Yes** (Rate Limited) |
| `/api/entries/:id/bookmark` | `PATCH` | Toggle bookmark status | **Yes** (Rate Limited) |
| `/api/entries/trash/purge` | `POST` | Permanently batch-delete trashed entries | **Yes** (Rate Limited) |
| `/api/entries/:id/media` | `POST` | Upload and attach multipart media | **Yes** (Rate Limited) |
| `/api/entries/:id/media/:mediaId` | `DELETE` | Delete attachment and Cloudinary asset | **Yes** (Rate Limited) |

For comprehensive documentation on request/response payloads, validation rules, and curl examples, see [backend/README.md](file:///C:/Users/lenovo/OneDrive/Desktop/dja/MindLog/backend/README.md).

---

## 🔒 Security Summary

MindLog implements multiple defense-in-depth protections:
- **HttpOnly Cookies**: Prevents client-side scripts from reading the authentication token.
- **CSRF & Origin Verification**: Disallowed or missing origins attempting state-changing requests are rejected with `403 FORBIDDEN`.
- **Multi-Tier Rate Limiting**: Guards against brute force, credential stuffing, and DoS (1000/15min general, 10/15min auth IP, 10/15min login email, 200/15min writes, 30/1h uploads).
- **NoSQL Injection Defense**: Recursive scanner (`rejectOperatorKeys`) blocks `$` and `.` parameter injection; Mongoose `sanitizeFilter` active globally.
- **Strict Ownership Scoping**: Queries enforce `{ _id, userId }`. Requests for unowned entries return `404 NOT_FOUND` rather than `403` to prevent ID enumeration.
- **Byte-Level Sniffing**: Inspects real binary magic bytes with `file-type` to detect spoofed file extensions, explicitly rejecting SVGs.
- **Reverse Proxy Keep-Alive Timeouts**: Configured with 65s/66s/300s server timeouts to prevent gateway disconnects during slow uploads.

---

## ⚠️ Known Limitations & Trade-Offs

1. **Free-Tier Cold Starts**: On Render's free tier, backend instances spin down after 15 minutes of inactivity. The first request after idle can experience a ~50-second wake-up delay.
2. **In-Memory Rate Limiting**: Rate limit buckets are stored in process memory. Counters reset upon server restart or redeployment, and are per-instance (requires Redis if scaled horizontally).
3. **Public Unguessable Media URLs**: Uploaded assets in Cloudinary use unguessable random UUIDs in folder hierarchies (`mindlog/{userId}/{entryId}/<uuid>`). Anyone with the exact URL can view the asset without authentication.
4. **Password Reset Flow**: Email verification and self-service password reset workflows are not implemented yet.
5. **No Per-User Storage Quota**: Aggregate media disk storage per user account is not currently capped at the application layer.

---

## 📂 Project Structure

```
MindLog/
├── backend/                           # Node.js + Express REST API
│   ├── src/
│   │   ├── config/                    # Database, environment, DNS, and limit configurations
│   │   │   ├── db.js                  # MongoDB Atlas connection with sanitizeFilter
│   │   │   ├── env.js                 # Zod environment schema & production fail-fast rules
│   │   │   ├── limits.js              # Centralized rate limit constants
│   │   │   └── dns.js                 # Opt-in custom DNS resolvers for Atlas SRV
│   │   ├── controllers/               # Express route handlers (auth, entry, health)
│   │   ├── middleware/                # Security, auth, error, and rate-limiting middleware
│   │   │   ├── enforceContentType.js  # 415 media type validator
│   │   │   ├── errorHandler.js        # Centralized API error response formatter
│   │   │   ├── noCache.js             # Strict Cache-Control: no-store header
│   │   │   ├── rateLimiter.js         # Multi-tier express-rate-limit factories
│   │   │   ├── rejectOperatorKeys.js  # Recursive NoSQL injection scanner
│   │   │   ├── requireAuth.js         # JWT verification & caller authentication
│   │   │   └── upload.js              # Multer configuration & magic-byte inspection
│   │   ├── models/                    # Mongoose schemas (User, Entry with embedded Media)
│   │   ├── routes/                    # API route definitions (/auth, /entries, /health)
│   │   ├── services/                  # Business logic (auth, entry, media, cloudinary)
│   │   ├── utils/                     # Token, cookie, objectId, and sanitize helpers
│   │   ├── validators/                # Zod request payload schemas
│   │   ├── app.js                     # Express app setup and middleware pipeline
│   │   └── server.js                  # HTTP server entrypoint with keep-alive timeouts
│   └── tests/                         # 178 automated tests (Node test runner + Supertest)
│       ├── auth/                      # Authentication & cookie tests
│       ├── entries/                   # Entry CRUD, trash, and sanitize tests
│       ├── media/                     # Upload, rollback, and magic-byte tests
│       ├── models/                    # Schema validation unit tests
│       └── security/                  # Rate limiter, proxy trust, NoSQL & HTTP hardening
├── src/                               # React + TypeScript + Vite Frontend
│   ├── components/                    # UI Components
│   │   ├── CalendarView.tsx           # Monthly entry grid & date filtering
│   │   ├── DeskScene.tsx              # Illustrated login scene
│   │   ├── EntryCard.tsx              # Dashboard entry card
│   │   ├── EntryEditor.tsx            # Rich entry editor modal
│   │   ├── ProtectedRoute.tsx         # Auth session route guard
│   │   ├── TimelineView.tsx           # Chronological media timeline
│   │   └── TrashView.tsx              # Recycle Bin with restore & purge
│   ├── context/
│   │   └── AuthContext.tsx            # Global user authentication state
│   ├── lib/
│   │   ├── api.ts                     # HTTP client with cookie credentials & error envelopes
│   │   └── entries.ts                 # Entry orchestration, upload chunking & date normalization
│   ├── pages/
│   │   ├── Journal.tsx                # Main application dashboard
│   │   └── Login.tsx                  # Login and account registration
│   ├── types.ts                       # Shared TypeScript interfaces
│   ├── App.tsx                        # Router configuration
│   ├── index.css                      # Tailwind styling & typography cascade rules
│   └── main.tsx                       # React application entrypoint
├── index.html                         # HTML template & Google Font preconnects
├── package.json                       # Frontend dependencies & build scripts
├── vite.config.ts                     # Vite proxy & build configuration
└── README.md                          # Project documentation
```
