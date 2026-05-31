# Spec for Migrate Backend to Cloudflare Workers

Title: Migrate Backend to Cloudflare Workers
Branch: claude/feature/migrate-backend-cloudflare-workers
Spec file: context/specs/migrate-backend-cloudflare-workers.md

## Summary

Migrate the Hono backend from Node.js (currently self-hosted via Dokploy) to Cloudflare Workers for improved reliability and global edge distribution. The frontend will be deployed to Cloudflare Pages. The database (Neon) is already migrated. This is a runtime swap, not a feature change — all existing behavior must be preserved.

Four dependencies currently incompatible with the Workers runtime must be replaced before deployment:
1. `bcrypt` (native addon) → `bcryptjs`
2. `nodemailer` + SMTP → Resend HTTP API (fetch-based)
3. In-memory rate limiter → Cloudflare-compatible rate limiting strategy (see Open Questions)
4. Neon `node-postgres` driver → Neon serverless HTTP driver

The Hono framework itself already supports Workers natively. Each swap keeps the app functional locally throughout — no big-bang cutover.

## Functional Requirements

- All existing API endpoints, auth flows, and notification behaviors work identically after migration
- Password hashing and verification produce equivalent results (bcrypt-compatible hashes remain valid after the bcrypt → bcryptjs swap)
- Email notifications are sent via Resend's HTTP API instead of SMTP; email content and triggers are unchanged
- Rate limiting continues to protect auth endpoints using Cloudflare KV; behavior is eventually consistent (acceptable for brute-force protection at this scale)
- `JWT_SALT_ROUNDS` is reduced from 10 to 8 to stay within the Workers free plan CPU time limit
- Database connections use the Neon serverless HTTP driver instead of `node-postgres`; all queries produce identical results
- The backend deploys to Cloudflare Workers via Wrangler; `wrangler.toml` is added to `packages/backend`
- The frontend deploys to Cloudflare Pages from `packages/frontend/dist`
- All environment variables are configured as Wrangler secrets / Pages environment variables
- The `migrate-prod.ts` script continues to run locally (from Node.js) using `PROD_DB` — it does not need to run on Workers

## Possible Edge Cases

- Existing password hashes (bcrypt) must still verify correctly after switching to `bcryptjs` — the two are algorithmically identical, but this should be explicitly confirmed
- Resend SMTP-relay vs HTTP API: the current nodemailer setup points at an SMTP host; if that host is Resend's SMTP relay, the content/credentials transfer directly. If it is a self-hosted SMTP server, the email configuration changes more significantly
- Workers have a 128MB memory limit and CPU time limits per request — the bcrypt work factor (`JWT_SALT_ROUNDS=10`) may need to be evaluated against Workers' CPU limits since bcrypt is CPU-intensive; `bcryptjs` (pure JS) is slower than native `bcrypt`
- `dotenv/config` is used in multiple files for local development; this must not break Workers builds where `dotenv` is irrelevant (env vars come from `wrangler.toml` secrets / bindings)
- The `DEV_CURRENT_TIME` clock-pinning used in dev/test (via `envVars.ts`) must still work locally after the migration
- Drizzle with the Neon serverless driver uses a different import path than `drizzle-orm/node-postgres` — all DB files that import from the node-postgres adapter must be updated
- `drizzle.config.ts` and `migrate-prod.ts` must continue to use `node-postgres` for local migration tooling (Drizzle Kit does not run on Workers)

## Acceptance Criteria

- `pnpm build` passes with no type errors against the Workers target
- The app deploys to Cloudflare Workers and all routes respond correctly
- Auth (register, login, JWT cookie) works end-to-end on Workers
- Password hashing/verification works for new registrations and existing accounts
- Email notification is sent successfully via Resend HTTP API
- Rate limiting rejects excessive requests on auth endpoints
- All DB reads and writes (picks, leaderboard, admin actions) work correctly via the Neon serverless driver
- `pnpm migrate` and `NODE_ENV=production npx tsx src/scripts/migrate-prod.ts` continue to work locally (Node.js path unchanged)
- `pnpm test` continues to pass (tests run in Node.js, not Workers)
- Frontend deploys to Cloudflare Pages and loads correctly against the Workers backend URL

## Decisions

- **Rate limiter strategy**: Cloudflare KV. Eventually consistent, but acceptable for brute-force protection at this scale — an attacker would need to precisely time requests within the replication window to exploit it. The current in-memory limiter resets on every cold start, which is worse. Durable Objects ruled out due to added complexity.

- **Email provider**: Resend HTTP API (fetch-based, no SMTP). `nodemailer` and all SMTP env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`) are removed. `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` are the only email env vars going forward.

- **bcrypt rounds**: Drop `JWT_SALT_ROUNDS` from 10 to 8. The Workers free plan has a 10ms CPU time limit; `bcryptjs` at 10 rounds consumes ~100–300ms of CPU on a cold isolate and will be terminated. 8 rounds stays within budget. Workers Paid ($5/mo, 30s CPU limit) can be revisited later if needed.

## Testing Guidelines

- Add a smoke test that imports the main Hono app entry point under the Workers adapter and confirms it initializes without throwing
- Verify `bcryptjs` hash/verify roundtrip produces the same boolean result as the current `bcrypt` calls (unit test)
- Verify Resend HTTP sender calls the correct endpoint with the correct payload (unit test with mocked fetch)
- Existing route tests and DB function tests should pass unchanged — they run under Node.js and are not affected by the Workers runtime swap

## Personal Opinion

This is a good migration for a multi-tenant app that needs real reliability — managed edge infrastructure beats a self-hosted VM. The scope is well-defined and the four dependency swaps are mostly mechanical.

All open questions are resolved. The rate limiter (KV) and bcrypt rounds (8) decisions are reasonable for a low-stakes seasonal app. Workers Paid is worth revisiting later — $5/mo buys back the full CPU budget and Cloudflare's built-in rate limiting.

Overall: straightforward migration, no remaining blockers.
