# Plan: Dev Season Simulation

## Context

The app is time-sensitive: pick deadlines, cron-driven score refreshes, and notifications all depend on the real system clock. There's currently no way to test the full pick → results → leaderboard → notification flow locally without live external data and real dates. This feature adds a fake clock (env-var controlled) and a seed/teardown system so the entire flow can be exercised with historical data in development.

---

## Step 1: Central `getNow()` Utility

**New file:** `packages/backend/src/utils/clock.ts`

- Exports a single `getNow(): Date` function
- If `NODE_ENV === 'production'`, always returns `new Date()` regardless of any env var
- Otherwise, checks `DEV_CURRENT_TIME` env var; if set and parseable, returns `new Date(process.env.DEV_CURRENT_TIME)`; falls back to `new Date()`
- Add `DEV_CURRENT_TIME` parsing to `packages/backend/src/utils/envVars.ts` (optional string, undefined in production)

**Migrate these call sites to `getNow()` — only the ones that affect simulation:**

| File | Line | Current call | Why it matters |
|------|------|--------------|----------------|
| `src/routes/user.ts` | 120 | `new Date()` | Pick deadline enforcement — **critical** |
| `src/cron/cronTick.ts` | 20 | `new Date()` | Sets `now` used for all cron decisions — **critical** |
| `src/cron/cronTick.ts` | 64 | `new Date()` | Score refresh timestamp — minor, but consistent |
| `src/notifications/dispatcher.ts` | 100 | `new Date()` | Default kickoff fallback — minor |

Leave alone: `middleware.ts` (request logging), `rateLimiter.ts` (in-memory windowing), `auth.ts` (email token timestamps) — none of these affect the simulated flow.

---

## Step 2: Seed Script

**New file:** `packages/backend/src/scripts/seed-dev.ts`

- Hard-codes 3 weeks of real 2024 CFB data (week 1 = Aug 31, week 2 = Sep 7, week 3 = Sep 14)
- Each week: ~8 games with real team names, real kickoff times, no scores (`completed: false`, `winningTeam: 'pending'`)
- Uses existing `addWeek()` and `upsertGameForWeek()` from `dbAdminFunctions.ts` — both are already idempotent
- After inserting games, calls `setPickedGames()` to mark all seeded games as picked (available to users)
- Gated: script exits early if `NODE_ENV === 'production'`
- Add `"seed:dev": "tsx src/scripts/seed-dev.ts"` to `packages/backend/package.json`

**Seed data source:** Hardcoded TypeScript fixtures matching the `AdminGameData` / `AdminWeekData` types from `packages/shared/types/cfb-pickem-api.ts`. Real game data from the 2024 season, committed as static fixtures — no API call at runtime.

---

## Step 3: Teardown Script

**New file:** `packages/backend/src/scripts/teardown-dev.ts`

- Deletes all rows from `admin.games` and `admin.weeks` for the known seed year/weeks (year=2024, weeks 1–3)
- User picks cascade-delete automatically via the existing FK `ON DELETE CASCADE` on `user.games → admin.games`
- Notification logs for these weeks are also cleared
- Gated: exits early if `NODE_ENV === 'production'`
- Add `"teardown:dev": "tsx src/scripts/teardown-dev.ts"` to `packages/backend/package.json`

---

## Step 4: Admin Endpoint — Mark Game Complete

**Add to:** `packages/backend/src/routes/admin.ts`

New route: `POST /api/admin/games/complete`

Request body (new Zod validator in `zValidate.ts`):
```
{ gameId: number, homePoints: number, awayPoints: number }
```

Behavior:
1. Gated: returns `403` if `NODE_ENV === 'production'`
2. Looks up the game via `returnGame(gameId)` — 404 if not found
3. Calculates `winningTeam` from points (same logic as `upsertGameForWeek` lines 134–141)
4. Updates the game row: `completed = true`, `homePoints`, `awayPoints`, `winningTeam`
5. After update, checks if all picked games for that week are now completed
6. If all complete, dispatches `rankings_updated` notification
7. Returns updated game data

**New DB function** in `dbAdminFunctions.ts`: `markGameComplete(gameId, homePoints, awayPoints)` — Drizzle update + return updated row.

**Frontend:** Add a `markGameComplete(gameId, homePoints, awayPoints)` function to `apis/adminRequests.ts`. Dev-mode UI panel is deferred — endpoint is sufficient for now.

---

## Step 5: Shared Types

**File:** `packages/shared/types/cfb-pickem-api.ts`

Add `MarkGameCompleteRequest` interface:
```typescript
export interface MarkGameCompleteRequest {
  gameId: number;
  homePoints: number;
  awayPoints: number;
}
```

---

## Step 6: Tests

**New file:** `packages/backend/tests/clock.test.ts`
- `getNow()` returns `DEV_CURRENT_TIME` when set and `NODE_ENV !== 'production'`
- `getNow()` returns current time when `DEV_CURRENT_TIME` is not set
- `getNow()` ignores `DEV_CURRENT_TIME` and returns real time when `NODE_ENV === 'production'`

**New file:** `packages/backend/tests/dev-endpoints.test.ts`
Uses the existing PGlite + `seedTestData()` pattern from `tests/setup.ts` and `tests/db-utils.ts`.
- `POST /api/admin/games/complete` returns 403 in production mode
- Marking a game complete sets `completed=true` and correct `winningTeam`
- Marking a game complete when all picks in the week are done triggers notification dispatch (mock `dispatchNotification`)
- Pick submission is blocked when `getNow()` returns a time >= game startTime
- Pick submission succeeds when `getNow()` returns a time before game startTime

---

## Critical Files

| File | Action |
|------|--------|
| `packages/backend/src/utils/clock.ts` | **Create** |
| `packages/backend/src/utils/envVars.ts` | Add `DEV_CURRENT_TIME` |
| `packages/backend/src/routes/user.ts:120` | Replace `new Date()` with `getNow()` |
| `packages/backend/src/cron/cronTick.ts:20,64` | Replace `new Date()` with `getNow()` |
| `packages/backend/src/notifications/dispatcher.ts:100` | Replace `new Date()` with `getNow()` |
| `packages/backend/src/db/dbAdminFunctions.ts` | Add `markGameComplete()` function |
| `packages/backend/src/routes/admin.ts` | Add `POST /api/admin/games/complete` |
| `packages/backend/src/utils/zValidate.ts` | Add `markGameCompleteValidator` |
| `packages/backend/src/scripts/seed-dev.ts` | **Create** |
| `packages/backend/src/scripts/teardown-dev.ts` | **Create** |
| `packages/backend/package.json` | Add `seed:dev` and `teardown:dev` scripts |
| `packages/shared/types/cfb-pickem-api.ts` | Add `MarkGameCompleteRequest` |
| `packages/frontend/src/apis/adminRequests.ts` | Add `markGameComplete()` |
| `packages/backend/tests/clock.test.ts` | **Create** |
| `packages/backend/tests/dev-endpoints.test.ts` | **Create** |

---

## Verification

1. Start dev DB: `docker compose -f docker/docker-compose-pg.yml up -d`
2. Run seed: `cd packages/backend && NODE_ENV=development pnpm seed:dev`
3. Start backend with fake clock before week 1 kickoffs: `DEV_CURRENT_TIME=2024-08-31T10:00:00Z NODE_ENV=development pnpm dev`
4. Log in as a user → verify games are visible and picks can be submitted
5. Change `DEV_CURRENT_TIME` to after kickoff → restart → verify picks are rejected
6. As admin, `POST /api/admin/games/complete` with scores → verify game shows winner
7. Check leaderboard → verify correct/incorrect counts update
8. Check logs for `rankings_updated` notification dispatch (or set `SKIP_EMAIL_SEND=false` with a real email)
9. Run teardown: `NODE_ENV=development pnpm teardown:dev` → verify seeded data gone
10. Run tests: `pnpm test:backend`

---

## Notes

- The `rankings_updated` notification currently fires from cron. Adding it to `markGameComplete` is deliberate duplication to make simulation work without cron. The dedup check in `dispatcher.ts` (`hasNotificationBeenSent`) prevents double-firing even if both paths execute.
- The seed script uses `upsertGameForWeek()` which has a unique constraint on `(year, weekNumber, homeTeam, awayTeam)` — re-running the seed is safe.
- Production guard on `markGameComplete` is a hard `NODE_ENV` check at the route level, not a configuration flag — safer than relying on someone forgetting to set an env var.
