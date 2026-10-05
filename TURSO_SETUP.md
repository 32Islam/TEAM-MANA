# PCOB + Turso setup

This version stores the durable tournament state in Turso (libSQL/SQLite-compatible cloud database). It does **not** require Google Cloud billing. Turso currently advertises a $0 Free plan with no credit card required.

## 1. Create the database

1. Create a free Turso account.
2. Create a database, for example `pcob`.
3. Copy its database URL.
4. Create a database auth token.

The application will create the `tournaments` and `tournament_meta` tables automatically on first request.

## 2. Vercel environment variables

Add these to your Vercel project for Production (and Preview if desired):

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Do not prefix these with `VITE_`; the token must remain server-side. After adding/changing them, redeploy.

## 3. What is persisted

- Tournament configuration
- Saved matches
- Current tournament ID
- Previous tournaments remain archived when a new tournament is created
- Browser `localStorage` remains a local cache/fallback

## 4. Test

After deployment, open:

`https://YOUR-VERCEL-DOMAIN/api/health`

Expected response:

`{"status":"ok","database":"turso",...}`

Then save a match, refresh the app, and open it from another device. The match should remain because the durable state is in Turso rather than the Vercel filesystem.

## 5. Important Vercel note

The Vercel deployment uses the files in `api/` for database requests. The local Express server in `server.ts` remains available for local development. Vercel's filesystem is not used as the durable database.

## 6. Assets

The current logo/background upload endpoints still use the local Express filesystem when running locally. For a Vercel deployment, those uploaded binary assets should eventually be moved to object storage (for example Vercel Blob or another storage provider). The tournament state itself is already durable in Turso.
