# EcoDrive — Cloudflare Workers + D1 Production Deployment Guide

This application runs completely on **Cloudflare Workers** (serving both the Vite React SPA static assets from `dist/` and `/api/*` backend routes) backed by **Cloudflare D1** for persistent storage.

---

## 1. Architecture Overview

- **Frontend**: React + TypeScript + Vite SPA built into `dist/` (`npm run build`).
- **Worker Entrypoint**: `worker/index.ts` handles all `/api/*` routes:
  - `GET /api/transport/resolved-pins` — Resolves official station & training centre pins from bundled route/branch data.
  - `GET /api/maps/geocode` & `GET /api/maps/reverse-geocode` — Server-side Google Maps Geocoding proxy.
  - `POST /api/transport/ai-recommendations` — Server-side Gemini AI recommendation proxy (`@google/genai`).
  - `GET / POST /api/admin/*` — Web Crypto (`PBKDF2-SHA256` + `SHA-256`) Admin Access Code setup, verification, session tokens, code change, logout, and D1-backed lockout rate limiting.
  - `GET / POST / PUT / DELETE /api/instructors*` & `/api/branch-info*` — Full CRUD and Excel/CSV import persisted in Cloudflare D1.
- **Static Assets & SPA Routing**: Configured in `wrangler.jsonc` with `"not_found_handling": "single-page-application"` and `"run_worker_first": ["/api/*"]`, so `/api/*` never falls back to `index.html` while frontend routes work cleanly.

---

## 2. Cloudflare D1 Database Setup

1. Create the D1 database in your Cloudflare account:
   ```bash
   npx wrangler d1 create ecodrive-db
   ```
2. Copy the returned `database_id` UUID into `wrangler.jsonc`:
   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "ecodrive-db",
       "database_id": "<YOUR_REAL_D1_DATABASE_ID>",
       "migrations_dir": "migrations"
     }
   ]
   ```
3. Apply the non-destructive schema migration (`migrations/0001_initial_schema.sql`):
   ```bash
   npm run db:migrate:remote
   ```
   > **Non-destructive guarantee**: `0001_initial_schema.sql` uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` only. Initial seeding of the 301 default instructors and 39 default branches happens automatically via `INSERT OR IGNORE` on first Worker API access only if tables are empty, and never overwrites existing records.

---

## 3. Safely Migrating Existing Local SQLite Data (`data/ecodrive.db`)

If you previously edited instructors or branches locally in `data/ecodrive.db`, export your existing records into idempotent `INSERT OR IGNORE` SQL statements and apply them to D1:

```bash
npm run db:export-sqlite
npx wrangler d1 execute ecodrive-db --remote --file=./data/d1-import-existing.sql
```

You can also upload updated `.xlsx`, `.xls`, or `.csv` workbooks anytime directly inside the **Instructors** or **Branch Information** pages after unlocking with your Admin Access Code.

---

## 4. Environment Variables & Secrets

### Cloudflare Workers Secrets (Server-side — NEVER expose with `VITE_`)
Set these via CLI (`npx wrangler secret put <NAME>`) or in Cloudflare Dashboard **Workers & Pages -> Settings -> Variables and Secrets**:

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | For AI Finder recommendations | Gemini API key used server-side in `POST /api/transport/ai-recommendations`. |
| `GOOGLE_MAPS_API_KEY` | Recommended for Geocoding proxy | Server-side Google Maps Geocoding/Reverse-Geocoding key (`VITE_GOOGLE_MAPS_API_KEY` is used as fallback on server if unset). |
| `ADMIN_ACCESS_CODE` | Optional | If set, overrides D1-stored Admin PIN using constant-time comparison; if omitted, admins set and change their PIN directly inside the UI (stored as PBKDF2-SHA256 in D1). |

### Vite Build Variable (Client-side Map JS SDK)
| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | For interactive Google Map UI | Public browser-restricted Google Maps JavaScript API key embedded at `npm run build` time. |

> Never put `GEMINI_API_KEY` or `ADMIN_ACCESS_CODE` into a `VITE_*` variable.

---

## 5. GitHub-Connected Cloudflare Workers Deployment

1. Push your repository to GitHub (ensure `.env`, `.dev.vars`, `data/`, and `.wrangler/` remain gitignored).
2. In Cloudflare Dashboard, open **Workers & Pages -> Create -> Import a repository** and select your GitHub repository.
3. Configure **Workers Builds**:
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler d1 migrations apply ecodrive-db --remote && npx wrangler deploy`
     *(Or run `npm run db:migrate:remote` once manually and set Deploy command to `npx wrangler deploy`.)*
4. Add `VITE_GOOGLE_MAPS_API_KEY` under **Build variables and secrets** (so `vite build` receives it).
5. Add `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, and optionally `ADMIN_ACCESS_CODE` under **Runtime variables and secrets**.
6. Verify the D1 binding `DB` -> `ecodrive-db` is attached under **Settings -> Bindings**.

---

## 6. Local Development & Testing Commands

```bash
# Type-check both frontend and Cloudflare Worker
npm run lint

# Build frontend + apply local D1 migrations + start local Worker on port 3000
npm run dev

# Dry-run production Cloudflare Worker bundle check
npx wrangler deploy --dry-run
```
