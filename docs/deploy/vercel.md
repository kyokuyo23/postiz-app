# Deploying the frontend to Vercel

Only `apps/frontend` (Next.js) runs on Vercel. The backend (NestJS), the
orchestrator (Temporal worker), PostgreSQL and Redis must be hosted elsewhere
(e.g. Railway, Render, or Docker). This guide was derived from reading the code;
it has **not** been exercised on a live Vercel project.

## Project settings

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Root Directory | `apps/frontend` |
| Include source files outside of the Root Directory | **Enabled** (the app imports `libraries/*`) |
| Node.js version | 22.x (repo requires `>=22.12.0 <23`) |
| Install / Build command | taken from `apps/frontend/vercel.json` |

`vercel.json` installs from the monorepo root, runs `prisma-generate`
(the frontend imports `@prisma/client` types/enums) and builds the frontend.

## Requirements found in the code

1. **Custom domains sharing one registrable domain.** The backend sets the
   `auth` cookie with `domain = "." + registrableDomain(FRONTEND_URL)`
   (`libraries/helpers/src/subdomain/subdomain.management.ts`). For
   `https://x.vercel.app` that resolves to `.vercel.app`, which browsers reject
   (public suffix), so login would fail. Use e.g. `app.example.com` (Vercel) and
   `api.example.com` (backend), `FRONTEND_URL=https://app.example.com`,
   `NEXT_PUBLIC_BACKEND_URL=https://api.example.com`. The cookie is
   `Secure; SameSite=None`, so both must be HTTPS. Do not set `NOT_SECURED`.
2. **Backend CORS** allows only `FRONTEND_URL` (and optional `MAIN_URL`), with
   credentials. Set `FRONTEND_URL` on the backend to the exact Vercel domain.
3. **Object storage.** Vercel's filesystem is ephemeral, and the `/uploads`
   rewrites in `next.config.js` only apply when `STORAGE_PROVIDER=local`. Use
   `STORAGE_PROVIDER=cloudflare` with the `CLOUDFLARE_*` variables from
   `.env.example`.
4. **Frontend environment variables** (Vercel): `NEXT_PUBLIC_BACKEND_URL`,
   `BACKEND_INTERNAL_URL`, `FRONTEND_URL`, `STORAGE_PROVIDER`, plus any
   `NEXT_PUBLIC_*` you use. `NEXT_PUBLIC_*` values are inlined at build time, so
   redeploy after changing them.
5. **Optional Sentry.** The build is Vercel-aware (`VERCEL_GIT_COMMIT_SHA`) and
   will not fail if Sentry variables are missing.
6. **Netlify.** If the repo is also connected to Netlify (no `netlify.toml`),
   disconnect it to avoid a failing extra check.

## Security-hardening flags (backend, all optional)

See `.env.example`: `SESSION_JWT_TTL`, `RESTRICT_PROVIDER_ACCOUNT_MUTATIONS`,
`CREDENTIAL_ENCRYPTION_KEYS`.
