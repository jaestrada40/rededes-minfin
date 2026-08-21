# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Centralized social media feed manager for MINFIN (Ministerio de Finanzas Públicas de Guatemala). Admins curate social posts into "Feeds", assign feeds to "Portals" (WordPress sites), and those portals pull the feed content via a public API + a bundled WordPress plugin shortcode.

Three parts in this repo:
- `backend/` — NestJS + Prisma + PostgreSQL API (source of truth, auth, admin operations)
- `frontend/` — React 19 + Vite + Tailwind admin SPA
- `wordpress-plugin/minfin-social-feed/` — PHP plugin that portals install to render feeds via `[minfin_social_feed]` shortcode, consuming the backend's public endpoints

## Commands

### Backend (`backend/`)
```
npm run start:dev      # nest start --watch, http://localhost:4000
npm run build           # nest build
npm run lint             # eslint --fix
npm run test              # jest unit tests (*.spec.ts colocated in src/)
npm run test -- users.service.spec.ts   # run a single test file
npm run test:watch
npm run test:e2e         # jest -c test/jest-e2e.json (test/*.e2e-spec.ts)
npx prisma migrate dev   # create/apply a migration after editing schema.prisma
npx prisma db seed       # runs prisma/seed.ts (ts-node)
```

### Frontend (`frontend/`)
```
npm run dev       # vite --port=3000
npm run build
npm run lint       # tsc --noEmit (no eslint configured)
```

### Local Postgres
```
docker-compose up -d   # postgres:16-alpine, db minfin_social, user/pass minfin/minfin
```

### Required env vars
- Root `.env` / `backend/.env`: `DATABASE_URL`, `PORT`, `CORS_ORIGIN` (backend **fails fast at boot** if `CORS_ORIGIN` is unset — see `main.ts`), `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN_DAYS`, `MFA_ENCRYPTION_KEY` (32-byte hex, AES-256-GCM key for encrypting stored TOTP secrets — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
- `frontend/.env`: `VITE_API_URL` (backend base URL). `GEMINI_API_KEY`/`APP_URL` are legacy AI-Studio-injected vars, not currently used by the app's own code paths.

## Architecture

### Backend module layout
Standard Nest module-per-domain under `backend/src/`: `auth`, `users`, `roles`, `audit`, `feeds`, `portals`, `settings`, plus `prisma` (global `PrismaModule`/`PrismaService`) and `common` (shared guards/decorators/filters). Each feature module wires its own controller/service/DTOs; `app.module.ts` is the single place they're assembled.

- **Auth**: `AuthModule` issues JWT access tokens + rotating refresh tokens (hashed, stored in `RefreshToken`, reuse triggers revocation) and supports TOTP MFA (`otplib`); TOTP secrets are stored AES-256-GCM encrypted (`MFA_ENCRYPTION_KEY`), never in plaintext. `isActive` is enforced on both login and refresh.
- **AuthZ**: role-based via `@Roles(...)` decorator + `RolesGuard`, checked against `request.user.role` (populated by `JwtStrategy`/`JwtAuthGuard`). Roles/permissions are DB-backed (`Role`, `Permission`, `RolePermission`), seeded in `prisma/seed.ts`.
- **Audit**: `AuditModule` persists an `AuditLog` row for sensitive actions across modules; the real actor id/role (not a placeholder) must be propagated into these calls from controllers/services.
- **Feeds/Portals**: `Feed` groups ordered `SocialPost`s (`FeedPost` join table with `order`) and is assigned to one or more `WordPressPortal`s (`FeedPortal` join table). `feeds.service.ts` is the largest service — covers CRUD, post linking/reordering, duplication, and portal assignment.
- **Public endpoints**: `public-feeds.controller.ts` and `public-settings.controller.ts` are unauthenticated read endpoints — this is what the WordPress plugin and external portals actually consume. Any change to `Feed`/`SocialPost`/`SystemSettings` shape should be checked against what these controllers expose.
- **Settings**: single-row `SystemSettings` (id `"default"`) holds institution-wide config: allowed CORS domains for portals, official account list, MFA-required policy, cache duration, webhook secret, maintenance mode. `UpdateSettingsDto` validates `allowedCorsDomains`/`officialAccounts` shape — don't relax this without checking downstream consumers.
- **Errors**: `HttpExceptionFilter` (global) maps Prisma errors (P2025 → 404, P2002 → 409) to HTTP responses; don't duplicate this mapping in individual services.
- **Validation**: global `ValidationPipe({ whitelist: true, transform: true })` — any DTO field not explicitly declared is silently stripped from the request body, a frequent source of "field not saving" bugs.

### Frontend
- `src/api/*.ts` — one file per backend domain (`auth`, `users`, `feeds`, `portals`, `settings`, `audit`), all going through `src/api/client.ts` (fetch wrapper, likely handling base URL + auth headers + refresh). This is a real API integration, not mocked — `src/data/initialData.ts` is legacy/fallback seed data only.
- `src/context/AppContext.tsx` is the central app state store (auth session, feeds, portals, settings, users) consumed by the view components in `src/components/`.
- Views map roughly 1:1 to backend modules: `FeedsView`/`FeedDetailView`, `PortalsView`, `SettingsView`, `UsersView`, `AuditView`, plus `AuthScreen` (login/MFA) and `FeedPublicPreview` (preview of what the public/portal-facing feed renders like).

### WordPress plugin
`wordpress-plugin/minfin-social-feed/minfin-social-feed.php` registers the `[minfin_social_feed]` shortcode and calls the backend's public endpoints to render a feed on a portal site. `minfin-social-feed.zip` is the distributable bundle — keep it in sync when the plugin PHP changes.
- Only `feed` (the feed's slug) is required: `[minfin_social_feed feed="slug"]`. `layout`, `limit`, `metrics`, and `media` are optional per-embed overrides — when omitted, each falls back to that feed's own `layoutDefault`/`maxItemsDefault`/`showMetrics`/`showMedia`, which are set from the "Vista Previa Embebida" screen's "Guardar como predeterminado del feed" button (`FeedPublicPreview.tsx`) or the feed edit form. Prefer the short form; only add explicit attributes to override the feed's default on one specific embed.
- The plugin caches each feed's API response in a WordPress Transient (`cache_seconds` setting, default 60s) — a change saved in the gestor can take up to that long to appear on a portal. For X posts specifically, the plugin renders the official `<blockquote class="twitter-tweet">` embed (loaded via `platform.x.com/widgets.js`) instead of a custom card, so it always matches what X itself shows; Facebook posts similarly use the official `plugins/post.php` embed. YouTube renders a real `<iframe>` embed.

## Conventions worth knowing
- Prisma migrations live in `backend/prisma/migrations/`; always go through `prisma migrate dev` rather than hand-editing `schema.prisma` + the DB separately.
- Audit-relevant mutations (users, feeds, portals, settings) should log through `AuditModule` with the real authenticated actor, not a generic system user.
- Backend tests are colocated (`*.service.spec.ts` next to the service); e2e tests live in `backend/test/*.e2e-spec.ts`.
