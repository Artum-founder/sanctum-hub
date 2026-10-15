# Sanctum hub

## Running on Replit

- Keep the imported Node.js HTTP server and static frontend structure.
- Install dependencies with `npm install` (or `npm ci` with the lockfile).
- Use the **Start application** workflow (`npm run dev`). Replit sets `PORT=5000`; the server binds to `0.0.0.0`.
- The onboarding form is at `/`; the admin page is at `/admin`.
- For a production-style start, use `npm start`.

## Required configuration

Add credentials through Replit Secrets, never source files:

- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`): existing Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`): server-only database key.
- `ADMIN_KEY`: a long random key chosen by the owner for `/admin`.

The existing database uses schema `tantric` by default (`HUB_SCHEMA` can override it). Tables are defined in `supabase/schema.sql`; do not replace the existing Supabase database. Startup reports `lagring: supabase` when configured and logs connection warnings if access fails.

Without Supabase credentials, the existing app uses `data/sanctum-hub.json` for local testing only. This is not safe persistent storage for a published app. Without `ADMIN_KEY`, admin access is disabled.

Optional settings: `CONTACT_NAME`, `CONTACT_EMAIL`. If login cookies are blocked in the embedded preview, open the preview in a separate browser tab.
