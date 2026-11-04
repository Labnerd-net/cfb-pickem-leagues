# Plan for demo-mode

Spec file: context/specs/demo-mode.md
Branch: claude/feature/demo-mode

Implement in four phases. Each phase is built, verified, and committed on its own (with permission), so the branch is always in a working state. Production behavior must be unchanged at the end of every phase.

## Phase 0: Feasibility checks (before any feature code)

These are the two assumptions the whole feature rests on. Verify them first on the real dev Worker.

1. **Pinned clock on a deployed Worker.** `utils/clock.ts` reads `process.env.NODE_ENV` directly, while `db/index.ts` documents that esbuild inlines that expression as "production" in a deployed bundle. Deploy to the existing dev Worker with `DEV_CURRENT_TIME` set and confirm a time-dependent endpoint (for example the active-week resolution or the pick deadline check) honors it. If it does not, change `getNow()` to use the same runtime-environment flag the DB layer uses (set through the Worker's `fetch` and `scheduled` entry points), and add a unit test.
2. **Auth cookie in non-production mode.** The demo must run with `NODE_ENV=development` for the clock to work. Confirm that the `cookieOptions` in `routes/auth.ts` still produce a cookie that works across the demo Worker's HTTPS origin (the dev Worker already does this, so this should be a quick confirmation).

Exit criteria: both confirmed on the dev Worker, with any fix committed.

### Phase 0 results

1. **Pinned clock: broken on every deployed Worker, now fixed.** A `wrangler deploy --dry-run` bundle showed `getNow()` compiled to `if (true) return new Date()`, so `DEV_CURRENT_TIME` was dead code, including on the dev Worker. Fix: `utils/clock.ts` now has `syncClockEnv(env)`, called from both `worker.ts` handlers next to `syncDbEnv`, and takes `NODE_ENV` and `DEV_CURRENT_TIME` from the Worker env binding. A missing binding value falls back to the inlined "production", so it fails safe to the real clock. The re-bundled output now has the runtime check. Unit tests cover the Worker-env paths; the full backend suite (409 tests) and the build pass. Verified by bundle inspection, not on a live Worker: end-to-end confirmation (a pick accepted for a game whose start time is between the real and pinned clocks) moves to the end of Phase 1, when the demo Worker has seeded data to observe it with. Nothing was deployed.
2. **Auth cookie in non-production mode: fine.** `secure` follows `isProduction`, so on the demo Worker the cookie is httpOnly and SameSite=Strict but not Secure. Same-origin HTTPS works with that, and the dev Worker already runs this way. Phase 2 sets `Secure` when `DEMO_MODE` is on.
3. **Frontend clock needs no fix.** It reads the build-time `VITE_DEV_CURRENT_TIME`. It also honors a `devCurrentTime` localStorage override set from the admin Dev Tools tab, so Phase 3 hides that tab in demo mode.

## Phase 1: Demo environment and seed/reset

Goal: a separate Worker and Neon branch that can be reset to a seeded state from a script. No visitor-facing features yet.

1. **Neon and Wrangler.**
   - Create the Neon `demo` branch (in the `CFB-picker` project) and migrate it.
   - Add `env.demo` to `wrangler.jsonc`: its own `vars` (`NODE_ENV=development`, `DEMO_MODE=true`, pinned `DEV_CURRENT_TIME`, `SKIP_EMAIL_SEND=true`), no `CRON_CACHE` KV binding, a custom domain route for `cfbpickem-demo.labnerd.net`, and `CLIENT_URL` set to that origin. Cron triggers are UTC-only, so add two triggers (05:00 and 06:00 UTC); the scheduled handler runs the reset only when the scheduled time falls in America/Chicago hour 0. Exactly one of the two triggers does so on every date (tested for every day of a year), so no stored marker is needed. Trade-off: a cron run delayed by more than an hour would skip that night's reset.
   - Real rate limit bindings for the demo (new namespace IDs), since `demo-login` needs a real limiter.
   - Secrets set with `wrangler secret put ... --env demo`: `DEV_DB` (pointing at the demo branch), a unique `JWT_SECRET`, and a placeholder `CFBD_API_KEY` (the env schema requires one; a dummy value means any leaked CFBD path fails). `PROD_DB` and `RESEND_API_KEY` are never set.
   - Add a `deploy:worker:demo` script next to the existing dev one.
2. **Seed module.** Create a shared seed-data module (for example `src/demo/seedData.ts`) holding the 2024 weeks, games with real final scores for the completed weeks, the demo league, the fake members and their picks, the two demo accounts (unusable password hashes, verified, reserved email domain, empty channel settings), and seeded notification-log rows. Build on the teams and dates in the existing `seed-dev.ts` and `seed-sim.ts`, extending to five weeks. Real scores are fetched once and committed as static data.
   - Weeks 1-3 completed; week 4 open for picks; week 5 games present in the global game cache but not in the league pool (the curation week).
3. **Reset function.** Create `src/demo/resetDemo.ts` that wipes demo-owned tables and reinserts the seed data using a minimal number of DB requests (one batched or transactional call, multi-row inserts, no per-row loops, no `Promise.all` fan-out). Must be idempotent and safe to re-run after partial failure. The two demo accounts (and seeded members) are inserted with fixed explicit IDs and the ID sequences are advanced past them, so a visitor's JWT remains valid across a reset. It refuses to run unless `DEMO_MODE` is on and unless it is connected to the DEV_DB database (never `PROD_DB`).
4. **Entry points.**
   - Local script `seed:demo` (tsx) that calls the reset function, for first-time seeding and on-demand reset.
   - In `worker.ts`, the `scheduled` handler runs `resetDemo` instead of `runCronTick` when `DEMO_MODE` is on.
5. **Tests.** Reset test using the existing PGlite setup: modify data, reset, assert seeded state; run twice. Test that reset refuses to run when `DEMO_MODE` is off.

Exit criteria: deploy to the demo Worker, run the seed, confirm the data via Drizzle Studio, trigger the scheduled handler, confirm reset. `pnpm build` and tests pass. Also the deferred Phase 0 check: with the demo Worker live, confirm the pinned clock takes effect (for example, a pick for a week 4 game is accepted although its real kickoff is in 2024).

### Phase 1 status

Code complete and tested locally (428 backend tests, type-check, lint, build, and `wrangler deploy --env demo --dry-run` pass):
- `DEMO_MODE` env flag (`utils/envVars.ts`), refreshed per invocation like the other Worker values.
- `src/demo/seedData.ts`: validated, deterministic seed builder. Fails loudly on empty or malformed game data.
- `src/demo/resetDemo.ts`: single `db.batch()` wipe-and-reseed with explicit IDs, then one statement to advance the serial sequences. Refuses unless `DEMO_MODE` is on.
- `src/demo/scheduledReset.ts` and the `worker.ts` scheduled branch: the demo Worker runs only the reset, never the cron tick.
- `src/scripts/seed-demo.ts` (`pnpm seed:demo`): local reset. Requires `DEMO_MODE=true` and `--wipe-host=<host of DEV_DB>` so a wrong `DEV_DB` cannot be erased by accident.
- `src/scripts/export-demo-games.ts` (`pnpm export:demo-games`): one-off CFBD export into `src/demo/demoGameData.ts`, currently an empty placeholder.
- `env.demo` in `wrangler.jsonc`, `deploy:worker:demo` script.

Needs the owner (external accounts or secrets): run the export with a CFBD key; create and migrate the Neon `demo` branch; set the demo Worker secrets; deploy; seed; verify.

## Phase 2: Demo login, registration lockout, and guard

Goal: the backend behavior of the demo. Still no frontend changes.

1. **Env flag.** Add `DEMO_MODE` to the env schema in `utils/envVars.ts` and export a flag. Add a startup check that refuses to run in demo mode if `PROD_DB` is present, or if `NODE_ENV` is `production`.
2. **Demo login route.** Add `POST /api/auth/demo-login`, registered only when the flag is on. The body selects `user` or `admin` (an enum, not an ID). Look up the fixed seeded accounts, issue the same JWT cookie as normal login, and apply the strict auth rate limit.
3. **Registration lockout.** When the flag is on, `POST /api/auth/register` returns 403. Also block `resend-verification`.
4. **Demo guard middleware.** Add `src/utils/demoGuard.ts` and mount it once at the app level in `index.ts`, active only when the flag is on:
   - Under `/api/admin/*` it is **deny by default**. Note that `/api/admin/leagues/*` is mounted under that prefix too. The allowlist: `GET /users`, `GET /weeks`, `GET /games`, `PATCH /games/:gameId/score`, `GET /notification-logs`, and `/api/admin/leagues/:leagueId/games` (GET), plus add/remove of a game (POST/DELETE).
   - Under `/api/leagues/*`, explicit blocks: delete league, `PATCH /:leagueId/channels`, `POST /:leagueId/broadcast`. Member role change and member removal are blocked when the target user is one of the two demo accounts (the guard looks up the target).
   - Under `/api/user/*` and `/api/auth/*`, explicit blocks: profile update, delete user, resend verification.
   - Blocked responses are 403 with a clear message and use the same error shape as other errors.
5. **Notification safety.** Confirm that, with no email API key, skip-send on, and empty channel settings, `dispatchGameComplete` after a score correction sends nothing. Add a test asserting no outbound sends happen.
6. **Tests.** Route tests for demo-login (absent when off; user/admin when on; rejects other values), registration lockout, each blocked route, each allowed route, demo-account member protection, and the deny-by-default enumeration test that walks the registered admin routes and fails if any is unclassified.

Exit criteria: deploy to the demo Worker and exercise the API with curl or the Bruno collection in `tests/bruno`. Flags off: existing tests still pass.

## Phase 3: Frontend

Goal: the visitor experience.

1. **Demo build config.** Add a Vite `demo` mode (`.env.demo`) with `VITE_DEMO_MODE=true`, the demo API URL, and the pinned `VITE_DEV_CURRENT_TIME`. Add a `build:demo` script that outputs to a separate directory, and make the demo Worker config point `assets.directory` at that directory so a demo bundle can never be served by the production Worker.
2. **Login page.** In `pages/Login.tsx`, when the flag is on, show the "Try the demo" section with two buttons (demo user, demo admin) calling a new function in `apis/authRequests.ts` through the Hono RPC client. Hide the register link and the email/password form. Hide the registration route.
3. **Banner.** A persistent demo banner component rendered in the app shell, stating this is a demo, data resets at midnight Central, and the season is fixed to 2024. It includes a live countdown to the next reset, computed with `Intl` in the America/Chicago time zone from the real clock (not the pinned `VITE_DEV_CURRENT_TIME`), updating each second or minute. At zero it shows "Resetting…" until the next tick after the reset time passes. Put the next-reset calculation in a small pure utility so it can be unit tested around daylight saving changes.
4. **Blocked-control handling.** Also hide the admin Dev Tools tab (it lets a user override the client clock via localStorage). Hide or disable controls for blocked actions (account deletion, profile and password settings, year import/delete, user export, role and password tools, channel settings save, broadcast forms, league delete) with a short explanation. Map 403 responses from the guard to a readable message as a fallback.
5. **Tests.** Component tests that the demo section and banner render only when the flag is on, and that the register link is hidden. Unit tests for the next-reset utility, including both daylight saving transitions.

Exit criteria: deploy the demo build; walk through both logins in a browser; screenshot for the README. `pnpm build` passes for both the normal and demo builds.

## Phase 4: Docs and portfolio

1. README section: what the demo is, URL (https://cfbpickem-demo.labnerd.net/), the two accounts, what is intentionally blocked, nightly reset.
2. `docs/DEVELOPMENT.md`: how to create the Neon branch, set secrets, deploy the demo (backend and the separate frontend build), seed and reset on demand.
3. Update CLAUDE.md with the demo environment, its flags, and the rule that new admin routes must be added to the demo allowlist (or they are blocked).
4. Add a screenshot or short GIF to the README.

## Risks and notes

- The two Phase 0 assumptions can force changes to `clock.ts`; keep that change minimal.
- Reset must stay within Worker subrequest limits; if a single batched call proves too large, split the data into a few ordered batches.
- The demo frontend and backend deploy as one Worker (assets plus API), so each demo deploy must run the demo frontend build first. Make the `deploy:worker:demo` script do both so they cannot drift.
- Do not deploy the demo to the shared dev Worker. It gets its own Worker name.
- Branching and commits follow the usual workflow: ask before each commit, conventional messages, no Claude attribution in messages.
