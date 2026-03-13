# Plan: Frontend/Backend Logging System

## Context

The app is deployed on Dokploy/Docker and currently has no structured logging. Debug output is scattered `console.log/error` calls with no level control. This makes it impossible to diagnose issues like the VITE_API_URL misconfiguration or firewall problems encountered during deployment. The spec calls for Pino on the backend (stdout, visible via `docker logs`) and a console-only frontend logger gated by a `VITE_LOG_LEVEL` build arg.

---

## Backend Changes

### 1. Install Pino
In `packages/backend/package.json`, add:
- `pino` (logger)
- `@types/pino` (dev dep, if needed — Pino ships its own types)

Run `pnpm install` in the backend package.

### 2. Create `src/utils/logger.ts` (new file)
- Instantiate a Pino logger with `level` read from `process.env.LOG_LEVEL ?? 'info'`
- Output: raw JSON to stdout (default Pino behavior — no pino-pretty in production)
- Export the logger as a singleton for use across the app

### 3. Update `src/utils/middleware.ts`
Replace the existing `logger` middleware (lines 8-11) which only logs method+URL with no timing:
- Import the Pino logger from `src/utils/logger.ts`
- Record start time before `await next()`
- After `next()`, log: method, path, status code, response time (ms) at `info` level
- Export keeps the same name `logger` so `src/index.ts` import doesn't change

### 4. Update `src/index.ts`
- Replace `console.log` startup message (line 41) with `logger.info(...)` including port, data source, and DB host

### 5. Update route handlers — `src/routes/auth.ts`, `admin.ts`, `user.ts`
All 3 files share the identical catch block pattern across 16 total endpoints:
```
console.error('An unexpected error occurred:', e);
```
- Import logger and replace each `console.error` with `logger.error(...)` including the error message and route context

### 6. Update external API files — `src/api/ncaa-api.ts`, `src/api/sdv.ts`, `src/api/cfbd.ts`
- Replace `console.log/error` calls with appropriately-leveled `logger.debug/error` calls
- Add equivalend `logger.debug/error` calls to `src/api/cfbd.ts` file

---

## Frontend Changes

### 7. Create `src/utils/logger.ts` (new file)
A thin wrapper around `console.*` gated by `import.meta.env.VITE_LOG_LEVEL`:

- Supported levels: `off` (default when unset), `error`, `warn`, `info`, `debug`
- Each level includes all levels above it (e.g. `warn` also logs `error`)
- Exports: `logger.debug()`, `logger.info()`, `logger.warn()`, `logger.error()`
- When level is `off` or unset, all methods are no-ops

### 8. Update `src/apis/userRequests.ts`, `adminRequests.ts`, `authRequests.ts`
Each of the 12 API functions has a catch block. Import and use `logger.error()` with:
- The endpoint/function name
- HTTP status code (if available from axios error)
- Error message

No structural changes — logger calls slot into existing catch blocks.

### 9. Update `src/components/user/UserPicksSection.tsx`
Replace 3 existing `console.error()` calls (lines 75, 162, 219) with `logger.error()`.

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/backend/package.json` | Add `pino` dependency |
| `packages/backend/src/utils/logger.ts` | **New** — Pino singleton |
| `packages/backend/src/utils/middleware.ts` | Replace logger middleware with Pino HTTP logging |
| `packages/backend/src/index.ts` | Replace console.log startup with logger.info |
| `packages/backend/src/routes/auth.ts` | Replace console.error → logger.error (3 places) |
| `packages/backend/src/routes/admin.ts` | Replace console.error → logger.error (6 places) |
| `packages/backend/src/routes/user.ts` | Replace console.error → logger.error (4 places) |
| `packages/backend/src/api/ncaa-api.ts` | Replace console.* → logger.* |
| `packages/backend/src/api/sdv.ts` | Replace console.* → logger.* |
| `packages/frontend/src/utils/logger.ts` | **New** — console wrapper gated by VITE_LOG_LEVEL |
| `packages/frontend/src/apis/userRequests.ts` | Add logger.error in catch blocks |
| `packages/frontend/src/apis/adminRequests.ts` | Add logger.error in catch blocks |
| `packages/frontend/src/apis/authRequests.ts` | Add logger.error in catch blocks |
| `packages/frontend/src/components/user/UserPicksSection.tsx` | Replace 3 console.error → logger.error |

---

## Tests

**Backend** (`packages/backend/tests/logger.test.ts`):
- Logger emits at `debug` level when `LOG_LEVEL=debug`
- Logger suppresses `debug` messages when `LOG_LEVEL=info`
- Request middleware log output includes method, path, status, duration fields
- Auth route error logging fires on login failure
- No password or token fields appear in log output

**Frontend** (`packages/frontend/tests/logger.test.ts`):
- Logger is a no-op (console not called) when `VITE_LOG_LEVEL` is unset
- Logger calls `console.error` when `VITE_LOG_LEVEL=error`
- Logger respects level hierarchy (info level suppresses debug calls)

---

## Verification

1. Run `pnpm build` — confirm both packages compile without errors
2. Start backend locally with `LOG_LEVEL=debug pnpm dev:backend` — confirm structured JSON logs appear in terminal for requests and startup
3. Start frontend with `VITE_LOG_LEVEL=debug pnpm dev:frontend` — open DevTools console, trigger an API error, confirm it appears
4. Start frontend without `VITE_LOG_LEVEL` set — confirm no console output for API errors
5. Run `pnpm test` — confirm all new tests pass
6. In Dokploy, set `LOG_LEVEL=info` on backend app, redeploy, run `docker logs <container> -f` and confirm request logs appear
