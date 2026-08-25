# MindLog 📖

🚀 **Live Site:** [https://mind-log-smoky.vercel.app](https://mind-log-smoky.vercel.app)

A private journal web app for capturing your thoughts, memories, and rich media entries.

---

## 🚀 Live Demo

You can access the live application here:  
👉 **[https://mind-log-smoky.vercel.app](https://mind-log-smoky.vercel.app)**

---

## What's in this phase

- **Login page** (`/login`) — email/password sign in and sign up, "forgot password"
  flow, and a hand-illustrated desk scene (laptop, notebook, pen, coffee) — no
  external images, so it renders identically on any machine.
- **Auth** — real Supabase Auth (`@supabase/supabase-js`). Sessions persist across
  refreshes; signing out clears them.
- **Protected journal page** (`/`) — only reachable when signed in. Search, a
  "New entry" button, and a list of entries sorted by date.
- **Entry editor** — title, an editable text body, and buttons to attach images,
  videos, or audio clips. Fully clickable today.
- Entries currently live in the browser's memory (they reset on refresh) — that's
  intentional for Phase 1. Phase 2 swaps this for permanent Supabase storage.

---

## 1. Create your Supabase project (5 minutes)

1. Go to [supabase.com](https://supabase.com) and sign in (free tier is enough).
2. Click **New project**. Pick any name/region and set a database password
   (save it somewhere — you won't need it for this phase, but you will for Phase 2).
3. Once the project finishes provisioning, open **Project Settings → API**.
4. Copy the **Project URL** and the **anon public** key.
5. By default, Supabase requires email confirmation for new sign-ups. That's fine —
   when you sign up in the app, check the inbox you used and click the confirmation
   link before signing in. (You can turn confirmation off under
   **Authentication → Providers → Email** while testing, if you'd rather skip that step.)

---

## 2. Run the project in Antigravity

1. Open this folder (`dear-diary/`) in Antigravity as your workspace root.
2. Open a terminal inside the IDE and install dependencies:
   ```bash
   npm install
   ```
3. Create your local env file:
   ```bash
   cp .env.example .env
   ```
   Then open `.env` and paste in the **Project URL** and **anon public key** from
   step 1.
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Open the printed local URL (usually `http://localhost:5173`). You should land
   on the login page. Create an account, confirm your email if prompted, sign in,
   and you'll land on the journal page.

If the terminal ever shows a warning about `Missing VITE_SUPABASE_URL`, it means
`.env` isn't filled in yet — auth calls will fail until it is.

---

## 3. Project structure

```
dear-diary/
├── src/
│   ├── components/
│   │   ├── DeskScene.tsx      # login page illustration
│   │   ├── EntryCard.tsx      # one row in the entry list
│   │   ├── EntryEditor.tsx    # new/edit entry modal
│   │   └── ProtectedRoute.tsx # redirects to /login when signed out
│   ├── context/
│   │   └── AuthContext.tsx    # app-wide session state
│   ├── lib/
│   │   └── supabase.ts        # Supabase client
│   ├── pages/
│   │   ├── Login.tsx
│   │   └── Journal.tsx
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
├── .env.example
└── package.json
```

## Design notes

Palette is a warm paper cream (`#EEEAE0`) with ink, sage, and gold accents —
tuned to sit easily on the eyes for something you'll open daily, day or night.
Headings use **Fraunces** (a warm serif with a handwritten feel), body text
uses **Work Sans**, and dates/labels use **IBM Plex Mono** for a
journal-dateline feel. All colors and type live in `tailwind.config.js` if
you want to adjust them.

## Next: Phase 2 (backend)

When you're ready, say so and I'll add:
- A `journal_entries` table + a `media` storage bucket in Supabase
- Row Level Security so each user only ever sees their own entries
- Real create/read/update/delete calls replacing the local state in `Journal.tsx`
- Actual file uploads (images/video/audio) to Supabase Storage instead of
  temporary in-browser object URLs

Then **Phase 3 (deployment)**: production build, hosting, environment
variables on the host, and pushing the finished repo to GitHub.
