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

MindLog features a modern decoupled architecture: a reactive **React + TypeScript + Vite** frontend and an enterprise-grade **Node.js + Express 4 + MongoDB Atlas** RESTful backend with **Cloudinary** media management.

### 🌟 Key Architecture & Scope Highlights

1. **Authentication & Session Security**:
   - Stateless JWT authentication delivered exclusively via **HttpOnly, SameSite=Lax** cookies (`mindlog_token`), neutralizing token-theft XSS.
   - Secure password hashing using **bcrypt** (12 rounds) with constant-time dummy comparisons to eliminate user enumeration through response timing attacks.
   - Multi-tier rate limiting via `express-rate-limit` v8 (General API, Per-IP Auth, Per-Email Login, Per-User Write, and Per-User Media Upload limiters).

2. **Rich Entry Editor & Customization**:
   - Dynamic modal editor supporting title typography and body formatting (`bold`, `italic`, `underline`, alignment, lists).
   - Real-time **Title Font** and **Body Font** customization across 12 typography options (including *Lora*, *Fraunces*, *Caveat*, *Comic Sans MS*, *Garamond*, and *SF Pro*), with custom font-size and line-height controls.
   - HTML sanitization using `sanitize-html` to prevent stored XSS, and tag-stripping title normalization that preserves plain entities (`&`, `"`, `<`, `>`) with guaranteed idempotence.

3. **Multi-Format Multimedia Attachments**:
   - Direct integration with **Cloudinary** supporting images (JPEG, PNG, WebP, GIF), audio recordings (MP3, M4A, WAV, OGG), and video clips (MP4, WebM, MOV).
   - Strict server-side **binary magic-byte inspection** (`file-type`), ensuring files match declared formats regardless of spoofed extensions. SVGs are rejected to eliminate script execution risks.
   - Atomic rollback and automated remote asset deletion on entry deletion or trash purge.

4. **Multi-View Journal Dashboard**:
   - **Grid Cards View**: Responsive cards displaying entry summaries, mood indicators, bookmark status, and attachment counts.
   - **Timeline View**: Chronological vertical feed grouped by months with expandable rich media and datelines.
   - **Interactive Calendar View**: Calendar matrix mapping entries to specific dates, with full support for date filtering and timezone-safe past back-dating (local noon normalization).
   - **Recycle Bin (Trash)**: Two-stage deletion lifecycle featuring soft-deleting, instant restoration, and permanent batch purging.

5. **Defense-in-Depth Security Hardening**:
   - **NoSQL Injection Defense**: Recursive scan (`rejectOperatorKeys`) rejecting `$`-prefixed or dot keys in query, body, and params, combined with Mongoose `sanitizeFilter` and `mongoose.trusted(...)`.
   - **Strict Ownership Scoping**: All entry lookups enforce `userId: req.user._id` and return `404 NOT_FOUND` for non-owned items to prevent resource ID enumeration.
   - **HTTP & Server Hardening**: Content-Type enforcement (`415 UNSUPPORTED_MEDIA_TYPE` on non-JSON payloads), `Cache-Control: no-store` on private data, proxy trust hops handling (`TRUST_PROXY_HOPS`), and 65s/66s/300s server timeouts for zero-downtime proxy streaming.

---

## 💻 Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS + Custom CSS Cascade Variables
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

## 🚀 Features Breakdown

| Feature | Description |
| :--- | :--- |
| **Authentication** | Registration, Login, Logout, and Current User profile retrieval via HttpOnly cookies. |
| **Journal Feed** | Dynamic entry listing with instant search, mood filtering, and bookmark toggling. |
| **Entry Editor** | Rich creation/editing interface with custom fonts, live word/character counts, and media uploads. |
| **Calendar View** | Visual monthly matrix showing journal activity per day with single-click back-dating. |
| **Timeline Feed** | Continuous chronological diary layout with embedded audio/video players. |
| **Recycle Bin** | Dedicated trash view with single-entry restoration, permanent deletion, and "Empty All Trash". |
| **Media Management** | Multi-file chunked upload (up to 5 per request, 20 per entry) with automated remote cleanup. |

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- **Node.js** v20.0.0 or higher
- **MongoDB Atlas** database cluster (or local MongoDB)
- **Cloudinary** account (for media hosting)

### 2. Clone the Repository
```bash
git clone https://github.com/Ram-bhardwaj12/MindLog.git
cd MindLog
```

### 3. Backend Setup
1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Configure environment variables by copying `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Populate `backend/.env` with your credentials:
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
   *(Listens on `http://localhost:5000` with health check at `/api/health`)*

5. Run backend automated tests:
   ```bash
   npm test
   ```

### 4. Frontend Setup
1. In the repository root, install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

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

---

## 🔒 Security Summary

- **Cookie Security**: `HttpOnly`, `SameSite=Lax`, and `Secure` (in production).
- **CORS Whitelist**: Explicitly restricted via `CLIENT_ORIGINS` with preflight caching (`maxAge: 600`) and `Vary: Origin`.
- **Input Sanitization**: HTML tag allow-lists for body content; plain text tag stripping for titles preserving user symbols idempotently.
- **Rate Limiting**: Multi-tiered barriers against brute force attacks across IP, email, write operations, and file uploads.
- **NoSQL Injection Defense**: Recursive `$` and `.` key rejection plus Mongoose filter sanitization.
- **Resource Privacy**: Strict ownership scoping on all queries returning uniform `404 NOT_FOUND` on unauthorized or non-existent items.
