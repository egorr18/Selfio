# Selfio

**Selfio** — lightweight journaling + planner for everyday focus:
Today check-in, tasks, habits, weekly plan, and account/plan management.

This repo is a **static frontend (HTML/CSS/JS)** deployed on **GitHub Pages**, using **Supabase** for:
- Auth (email + password)
- Database (profiles/state)
- Row Level Security (RLS)

## Tech stack
- HTML / CSS / Vanilla JS
- Supabase (Auth + Postgres + RLS)
- GitHub Pages hosting

## Project structure
- `index.html` — landing
- `pages/` — app pages (Today / Weekly / Habits / Account / Choose plan)
- `css/` — styles (`global.css`, `app.css`, `pages.css`, optional `home.css`)
- `js/` — app logic
  - `js/core/config.js` — app config (mode + Supabase keys)
  - `js/cloud/supabase.js` — Supabase client + cloud API
  - `js/core/auth.js` — auth helpers
  - `js/core/store.js` — state load/save (local + cloud)
- `supabase/migrations/` — SQL migrations (schema + RLS + indexes)

## Local run
Open with any static server (recommended: VS Code Live Server).
Start from:
- `pages/signin.html` (auth)
- `pages/app.html` (Today)

## Supabase setup (quick)
1. Create a Supabase project
2. Run SQL from `supabase/migrations/` in order:
   - `001_initial_schema.sql`
   - `002_rls_policies.sql`
   - `003_indexes.sql`
3. In Supabase Auth settings, add Redirect URLs for:
   - local dev (your Live Server URL)
   - GitHub Pages URL

## Config
Update `js/core/config.js`:
- `supabaseUrl`
- `supabaseAnonKey`
- `emailRedirectTo` (optional redirect for email confirm)

> Note: `anon` key is meant to be public. Security is enforced via RLS policies.

## Deployment
Push to `main` → GitHub Pages serves the site.

---
Made with focus on simplicity and speed ✅
