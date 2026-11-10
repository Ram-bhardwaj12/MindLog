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

## 🎯 Project Scope

The **Digital Journal App (MindLog)** is a personal journaling web application crafted to provide users with a private, seamless, and aesthetically engaging space to document daily thoughts, track moods, and save rich media memories.

### 🌟 Core Objectives & Scope Highlights

1. **User Authentication & Privacy**:
   - Secure Sign-up, Sign-in, and Session Persistence implemented via **Supabase Auth**.
   - Strict Row-Level Security (RLS) policies ensuring individual data isolation so each user only accesses their own private journal entries.

2. **Rich Media Entry Management**:
   - Dynamic Entry Editor allowing users to create, update, and organize daily logs.
   - Support for rich multimedia attachments including **Images**, **Audio Clips**, and **Video** embeds.
   - Real-time search and filter functionality for easy retrieval of entries by date, title, or keywords.

3. **Modern & Intuitive UI/UX Design**:
   - Thoughtfully curated color system featuring warm paper cream tones (`#EEEAE0`), dark ink text, sage, and gold accents to minimize eye strain.
   - Elegant typography pairing **Fraunces** serif headings, **Work Sans** body text, and **IBM Plex Mono** datelines.
   - Fully responsive design optimized across mobile, tablet, and desktop screens.

4. **Cloud Infrastructure & Persistence**:
   - Integrated with **Supabase PostgreSQL** database for persistent data storage.
   - Dedicated Supabase Storage Buckets for uploading and hosting user multimedia assets.

5. **Deployment & CI/CD**:
   - Continuous deployment hosted on **Vercel**, fully linked with the GitHub main repository.

---

## 🚀 Features Breakdown

- **Login & Auth Page (`/login`)**: Email/Password authentication, "Forgot Password" workflow, and an illustrated workspace scene.
- **Protected Journal Dashboard (`/`)**: Gated route requiring active auth session, featuring entry search, filter chips, and interactive entry cards.
- **Entry Editor Modal**: Full-featured creation modal for drafting titles, body copy, and attaching multimedia assets.

---

## 💻 Tech Stack

- **Frontend Framework**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS + Custom Typography (Fraunces & IBM Plex Mono)
- **Backend & Auth**: Supabase (PostgreSQL + Auth + Storage)
- **Icons**: Lucide React
- **Deployment**: Vercel

---

## 🛠️ Local Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Ram-bhardwaj12/MindLog.git
   cd MindLog
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 📂 Project Structure

```
MindLog/
├── src/
│   ├── components/
│   │   ├── DeskScene.tsx      # Illustrated login scene
│   │   ├── EntryCard.tsx      # Single journal entry item
│   │   ├── EntryEditor.tsx    # Entry editor modal
│   │   └── ProtectedRoute.tsx # Route protection guard
│   ├── context/
│   │   └── AuthContext.tsx    # Supabase session provider
│   ├── lib/
│   │   └── supabase.ts        # Supabase client setup
│   ├── pages/
│   │   ├── Login.tsx          # Login & Signup view
│   │   └── Journal.tsx        # Dashboard & Entries list
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── package.json
└── README.md
```

---

## 🎨 Design & Palette

- **Primary Canvas**: `#EEEAE0` (Warm Cream Paper)
- **Typography**: 
  - Headings: `Fraunces`
  - Body: `Work Sans`
  - Datelines/Metadata: `IBM Plex Mono`
