# Selfio

**Selfio** — lightweight journaling + planner for everyday focus:  
Today check-in, tasks, habits, weekly plan, and account/plan management.

**Live demo:** https://egorr18.github.io/Selfio/

This repo is a **static frontend (HTML/CSS/JS)** deployed on **GitHub Pages**, using **Supabase** for:
- Auth (email + password)
- Database (profiles / user state)
- Row Level Security (RLS)

## Features
- ✅ Today check-in (quick reflection)
- ✅ Weekly planning + tasks
- ✅ Habit tracking
- ✅ Account / Plan page
- ✅ Theme toggle (light/dark)
- ✅ Multi-language (EN/UK)
- ✅ SEO basics: `robots.txt` + `sitemap.xml`

## Tech stack
- HTML / CSS / Vanilla JS
- Supabase (Auth + Postgres + RLS)
- GitHub Pages hosting

## Project structure
- `index.html` — language gate / landing
- `en/`, `uk/` — localized pages
- `css/` — styles (`global.css`, `app.css`, `pages.css`)
- `js/` — app logic
  - `js/core/config.js` — Supabase config
  - `js/cloud/supabase.js` — Supabase client + queries
  - `js/core/auth.js` — auth helpers
  - `js/core/store.js` — state load/save (local + cloud)
- `supabase/migrations/` — SQL migrations (schema + RLS + indexes)
- `robots.txt`, `sitemap.xml` — indexing helpers

## Local run
Use any static server (recommended: VS Code Live Server).

Start pages:
- `en/pages/signin.html` or `uk/pages/signin.html`
- `en/pages/app.html` or `uk/pages/app.html`

## Supabase setup (quick)
1. Create a Supabase project
2. Run SQL from `supabase/migrations/` in order:
   - `001_initial_schema.sql`
   - `002_rls_policies.sql`
   - `003_indexes.sql`
3. In Supabase → Auth settings, add Redirect URLs for:
   - local dev (your Live Server URL)
   - GitHub Pages URL (project pages)

## Config
Update `js/core/config.js`:
- `supabaseUrl`
- `supabaseAnonKey`
- `emailRedirectTo` (optional)

> Note: the `anon` key is meant to be public. Security is enforced via Supabase RLS policies.

## SEO (quick notes)
- `robots.txt` points to `sitemap.xml`
- `sitemap.xml` lists public pages (EN + UK)

## Deployment
Push to `main` → GitHub Pages serves the site.

## Roadmap
- [ ] Better post-login “app home” (not marketing)
- [ ] Templates (study / gym / focus)
- [ ] Streaks + reminders
- [ ] Export (CSV / PDF)

---
Made with focus on simplicity and speed ✅
