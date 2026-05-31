# Plan: Migrate Backend to Cloudflare Workers

## Context

The backend currently runs on self-hosted Dokploy (Node.js). Multi-tenant use requires better reliability. The migration moves the Hono backend to Cloudflare Workers (free plan) and the frontend to Cloudflare Pages. The Neon DB is already migrated.

Five things need to change for Workers compatibility:
1. DB driver: `node-postgres` uses TCP (unsupported in Workers) → `@neondatabase/serverless` HTTP driver
2. Password hashing: `bcryptjs` is CPU-heavy and risks exceeding the Workers 10ms CPU budget → Web Crypto PBKDF2 (`crypto.subtle`), which is native to the Workers runtime and not subject to JS CPU limits
3. Rate limiter: in-memory Map → Cloudflare KV (with in-memory fallback for local dev)
4. `node-cron` scheduler → Cloudflare Cron Trigger (`scheduled` export)
5. `@hono/node-server` entry → Workers `fetch`+`scheduled` export

Good news from exploration:
- Email is already on Resend SDK (no nodemailer anywhere), no email changes needed
- No existing users in this app — the password hash format change (bcrypt → PBKDF2) requires no migration
- Tests mock `src/db/index.ts` entirely via PGlite (`vi.mock`), so the DB driver swap doesn't break tests

---

## Step 1: Install Dependencies

In `packages/backend`:

```
pnpm add @neondatabase/serverless
pnpm add -D wrangler @cloudflare/workers-types
```

`@cloudflare/workers-types` provides KV type definitions. No `ws` package needed — the HTTP driver requires no WebSocket.

---

## Step 2: Replace bcryptjs with Web Crypto PBKDF2

`bcryptjs` runs in JS and can exceed the Workers 10ms CPU budget even at reduced rounds. `crypto.subtle` (PBKDF2) is native to the Workers runtime and does not count against the JS CPU limit. No migration needed — this app has no existing users.

**`src/utils/password.ts`** (new): encapsulate PBKDF2 hash and verify behind a simple interface:

```typescript
const ITERATIONS = 200_000;
const KEY_LENGTH = 32; // bytes

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveKey(password, salt);
  return `${toBase64(salt)}:${toBase64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':');
  const salt = fromBase64(saltB64);
  const bits = await deriveKey(password, salt);
  return timingSafeEqual(bits, fromBase64(hashB64));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const buf = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, KEY_LENGTH * 8);
  return new Uint8Array(buf);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function toBase64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
```

**`src/utils/envVars.ts`**: Remove `bcryptSaltRounds` / `JWT_SALT_ROUNDS`.

**`src/routes/auth.ts`**, **`src/routes/admin.ts`**, **`src/routes/user.ts`**: Replace `bcrypt.hash()` / `bcrypt.compare()` imports and calls with `hashPassword()` / `verifyPassword()` from `src/utils/password.ts`. Three call sites total:
- `admin.ts:74` — `bcrypt.hash(password, bcryptSaltRounds)` → `hashPassword(password)`
- `auth.ts:57` — `bcrypt.hash(password, bcryptSaltRounds)` → `hashPassword(password)`
- `auth.ts:102` — `bcrypt.compare(password, user[0].passwordHash)` → `verifyPassword(password, user[0].passwordHash)`
- `user.ts:83` — `bcrypt.compare(currentPassword, user[0].passwordHash)` → `verifyPassword(currentPassword, user[0].passwordHash)`
- `user.ts:91` — `bcrypt.hash(newPassword, bcryptSaltRounds)` → `hashPassword(newPassword)`

**`src/utils/passwordValidation.ts`**: Remove the 72-character bcrypt truncation note from the comment — it no longer applies.

**`package.json`**: Remove `bcryptjs` and `@types/bcryptjs` dependencies.

**`.env.example`**: Remove `JWT_SALT_ROUNDS`.

---

## Step 3: Swap DB Driver

**`src/db/index.ts`**: Replace `drizzle-orm/node-postgres` + `pg` with `drizzle-orm/neon-http` + `@neondatabase/serverless`. Neon explicitly recommends the HTTP driver for Cloudflare Workers; the WebSocket Pool is not recommended because WebSocket connections can't outlive a single request.

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.PROD_DB ?? process.env.DEV_DB ?? '');
export const db = drizzle(sql);
```

Connection string logic simplifies — `process.env` works in Workers via `nodejs_compat` + `nodejs_compat_populate_process_env` (both flags required; `nodejs_compat` alone does not populate `process.env` with bindings/secrets).

**Transaction caveat**: The HTTP driver supports non-interactive batch transactions only. Reading the 4 call sites, 2 are interactive (they read a result then use it in a subsequent write within the same transaction):
- `createLeague` (`dbLeagueFunctions.ts:15`): INSERTs a league, reads back its ID via `RETURNING`, then INSERTs a member row using that ID
- `correctGameScore` (`dbAdminFunctions.ts:377`): SELECTs the current game state, computes `winningTeam`, then UPDATEs + INSERTs an audit row

These 2 call sites must be refactored during implementation:
- `correctGameScore`: move the SELECT to the route handler and pass the computed `winningTeam` as a parameter — transaction becomes a simple UPDATE + INSERT batch
- `createLeague`: refactor to two separate sequential operations (INSERT league → INSERT member), accepting the tiny window of inconsistency (acceptable risk at this app's scale)

The other 2 (`deleteUserWithAudit`, `addPickedGamesBatch`) are non-interactive and work as-is.

**`drizzle.config.ts` and `src/scripts/migrate-prod.ts`**: Keep `node-postgres`. These are local Node.js tooling only, never bundled for Workers.

---

## Step 4: KV Rate Limiter

**`src/utils/rateLimiter.ts`**: Add KV path alongside the existing in-memory path.

Define a minimal `KVNamespace` interface locally (avoids polluting the Node.js tsconfig with Workers types):

```typescript
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}
```

In the `rateLimit()` middleware:
- Detect KV via `(c.env as { RATE_LIMIT_KV?: KVNamespace })?.RATE_LIMIT_KV`
- If KV present: read count from KV, increment, write back with TTL in seconds, return 429 if over limit
- If KV absent (local dev): use existing in-memory Map logic unchanged

The `authRateLimit` and `apiRateLimit` preset exports don't change signature.

`clearRateLimitStore()` (used in tests) continues to work — it only touches the in-memory store.

**`src/index.ts`**: Add `Bindings` type to the Hono app so TypeScript knows `c.env.RATE_LIMIT_KV` exists:

```typescript
type Bindings = { RATE_LIMIT_KV: KVNamespace }
const app = new Hono<{ Bindings: Bindings }>()
```

The same `KVNamespace` local interface can be reused here.

---

## Step 5: Split Entry Points

Currently `src/index.ts` contains both the Hono app definition AND the Node.js server startup (`serve()` + `node-cron`). The frontend imports `AppType` from `@backend/index.js` so the app + AppType must stay in `src/index.ts`.

**`src/index.ts`**: Remove `serve()` call and `node-cron` import/setup. Keep: Hono app, middleware, routes, error handler, `AppType` export. Export `app` as a named export.

**`src/server.ts`** (new): Node.js entry — import `app` from `./index.js`, call `serve()`, set up `node-cron`:

```typescript
import { serve } from '@hono/node-server';
import cron from 'node-cron';
import { app } from './index.js';
import { runCronTick } from './cron/cronTick.js';
import { serverPort } from './utils/envVars.js';
import pinoLogger from './utils/logger.js';

serve({ fetch: app.fetch, hostname: '0.0.0.0', port: serverPort }, info => {
  pinoLogger.info({ port: info.port }, 'Server started');
  cron.schedule('*/15 * * * *', () => {
    runCronTick().catch(err => pinoLogger.error(err, 'cron tick failed'));
  });
});
```

**`src/worker.ts`** (new): Workers entry — import `app` from `./index.js`, export `fetch` and `scheduled`:

```typescript
/// <reference types="@cloudflare/workers-types" />
import { app } from './index.js';
import { runCronTick } from './cron/cronTick.js';
import pinoLogger from './utils/logger.js';

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, _env: unknown, _ctx: ExecutionContext) {
    await runCronTick().catch(err => pinoLogger.error(err, 'cron tick failed'));
  },
};
```

**`package.json` script updates**:
- `dev`: `tsx watch src/server.ts` (was `src/index.ts`)
- `start`: `node dist/backend/src/server.js` (was `src/index.js`)
- `start:prod`: update same
- Add `dev:worker`: `wrangler dev`
- Add `deploy:worker`: `wrangler deploy`

---

## Step 6: Wrangler Config

**`packages/backend/wrangler.toml`** (new):

```toml
name = "cfb-pickem-api"
main = "src/worker.ts"
compatibility_date = "2024-09-23"   # must be 2024-09-23+ for full nodejs_compat
compatibility_flags = ["nodejs_compat", "nodejs_compat_populate_process_env"]

[triggers]
crons = ["*/15 * * * *"]

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "<kv-namespace-id>"          # fill after `wrangler kv namespace create`
preview_id = "<preview-id>"       # fill after `wrangler kv namespace create --preview`

[vars]
NODE_ENV = "production"
# All other env vars are set as secrets via: wrangler secret put <KEY>
```

**Secrets to set via `wrangler secret put`**: `PROD_DB`, `JWT_SECRET`, `CFBD_API_KEY`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, and any notification channel vars.

**Local Workers dev (`.dev.vars`)**: `wrangler dev` reads secrets from `.dev.vars` (not `.env`). Add this file to `.gitignore` and populate it with the same vars as `.env` when testing locally via `wrangler dev`. The normal `pnpm dev:backend` path still uses `.env` as before.

---

## Step 7: Cleanup

**`.env.example`**: Remove all `SMTP_*` vars — they're dead legacy code, the app has used Resend SDK for some time.

---

## Step 8: Verification

1. `pnpm build` — TypeScript compile passes
2. `npx tsc --noEmit -p packages/backend/tsconfig.json` — no type errors
3. `pnpm test:backend` — all tests pass (PGlite mock is unaffected by driver swap)
4. `pnpm dev:backend` (via updated `server.ts`) — local dev still works, picks up `DEV_DB`
5. `wrangler dev` — Workers local dev emulator works, KV is simulated
6. `wrangler deploy` — deploys to Workers
7. Post-deploy smoke test: register, login, make picks, view leaderboard

---

## Files Changed

| File | Action |
|---|---|
| `src/utils/password.ts` | New — PBKDF2 hash/verify via `crypto.subtle` |
| `src/utils/envVars.ts` | Remove `bcryptSaltRounds` / `JWT_SALT_ROUNDS` |
| `src/utils/passwordValidation.ts` | Remove bcrypt 72-char truncation note |
| `src/routes/auth.ts` | Replace `bcryptjs` with `hashPassword`/`verifyPassword` |
| `src/routes/admin.ts` | Replace `bcryptjs` with `hashPassword` |
| `src/routes/user.ts` | Replace `bcryptjs` with `hashPassword`/`verifyPassword` |
| `src/db/index.ts` | Replace `node-postgres` with `@neondatabase/serverless` HTTP driver |
| `src/db/dbLeagueFunctions.ts` | Refactor `createLeague` — remove interactive transaction |
| `src/db/dbAdminFunctions.ts` | Refactor `correctGameScore` — move SELECT to route handler |
| `src/utils/rateLimiter.ts` | Add KV path; local interface for `KVNamespace` |
| `src/index.ts` | Remove `serve()`+`node-cron`; add `Bindings` type; export `app` named |
| `src/server.ts` | New — Node.js entry (serve + cron) |
| `src/worker.ts` | New — Workers entry (fetch + scheduled) |
| `wrangler.toml` | New — Workers config |
| `.dev.vars` | New — local Workers dev secrets (gitignored) |
| `package.json` | Remove `bcryptjs`/`@types/bcryptjs`; update dev/start scripts; add deploy:worker/dev:worker |
| `.env.example` | Remove dead SMTP_* vars; remove `JWT_SALT_ROUNDS` |
