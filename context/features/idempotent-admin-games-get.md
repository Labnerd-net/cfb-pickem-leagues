# Plan: Idempotent Admin Games GET

## Context

`GET /admin/games` and `GET /admin/weeks` both silently fetch from external APIs and write to the DB when data is missing. This violates HTTP semantics (GETs must not produce side effects), obscures the cost of external API calls, and makes debugging harder. The fix splits each route into a pure read (GET) and an explicit action (POST). The `POST /admin/week` and `POST /admin/year/:year` endpoints already exist; the work is stripping side effects from the GETs and making re-import safe via upsert.

---

## Key Findings

- `GET /admin/games` (`admin.ts:60–89`): auto-loads weeks if missing, then auto-fetches + inserts games if missing.
- `GET /admin/weeks` (`admin.ts:35–48`): also auto-loads weeks from external API if none found. **Same problem, same fix needed.**
- `POST /admin/week` (`admin.ts:50–58`): already exists, takes `{year, week}` JSON body, fetches from external API, inserts games. This is the correct import action — already wired up in `adminRequests.ts` as `addGamesToWeek()`.
- `POST /admin/year/:year` (`admin.ts:26–33`): already exists for seeding weeks. Already wired as `addWeeksToYear()`.
- `addGameToWeek()` (`dbAdminFunctions.ts:96–125`): plain `db.insert()` with no conflict handling. Re-importing duplicates rows.
- `adminGames` schema (`schema/admin.ts`): `gameId` is serial PK; `cfbdGameId` and `ncaaGameId` are both nullable with no unique constraints. **No existing upsert target.**
- User picks FK: `user.games.gameId → admin.games.gameId` with cascade delete. Deleting + re-inserting games would wipe user picks. **Must upsert, not replace.**
- `enrichWeekIdentifier()` throws if the week doesn't exist in the DB, so `POST /admin/week` already errors correctly if weeks haven't been seeded first.

---

## Implementation Plan

### Step 1 — DB migration: add unique constraint for upsert target

Add a unique constraint on `(year, week_number, home_team, away_team)` to `admin.games`. This is the natural key that works across all data sources and enables upsert without touching `picked` or `gameId`.

- Edit `packages/backend/src/db/schema/admin.ts`: add `unique().on(table.year, table.weekNumber, table.homeTeam, table.awayTeam)` to the table definition.
- Run `pnpm generate` then `pnpm migrate` (and `NODE_ENV=test pnpm migrate` for test DB).

### Step 2 — Add `upsertGameForWeek` to `dbAdminFunctions.ts`

Add a new function alongside `addGameToWeek` that uses `onConflictDoUpdate` targeting the new unique constraint. It updates `completed`, `homePoints`, `awayPoints`, `winningTeam`, `seasonType` — and explicitly leaves `picked` and `gameId` unchanged.

File: `packages/backend/src/db/dbAdminFunctions.ts`

### Step 3 — Strip side effects from `GET /admin/games`

Remove lines 68–87 from `admin.ts`. The route becomes:

```
parse year/week → returnGamesForWeek() → return { weekGames }
```

Empty array returned if no games imported. No external API calls, no writes.

File: `packages/backend/src/routes/admin.ts`

### Step 4 — Strip side effects from `GET /admin/weeks`

Remove lines 40–45 from `admin.ts`. The route becomes:

```
parse year → returnWeeksByYear() → return { weeks }
```

Empty array returned if weeks not seeded. No external API calls, no writes.

File: `packages/backend/src/routes/admin.ts`

### Step 5 — Update `POST /admin/week` to use upsert and return better feedback

- Replace `addGameToWeek` call with `upsertGameForWeek` so re-import is safe.
- Return `{ status: 'imported N games' }` with the count, and a 404/422 with a clear message if `gameData` is empty (external API returned nothing).

File: `packages/backend/src/routes/admin.ts`

### Step 6 — Update `AdminSection.tsx` to handle empty states and import actions

Current behavior: GET auto-loads, so the admin never sees an empty state.

New behavior:
- On year select → call `getWeeksForYear()`:
  - If weeks returned → populate week dropdown (no change)
  - If empty → show "No weeks loaded for {year}" message + "Load Weeks" button that calls `addWeeksToYear(year)` with loading state
- On week select → call `getGamesForWeek()`:
  - If games returned → render GamesList (no change) + add "Re-import" secondary button
  - If empty → show "No games imported for this week" message + "Import Games" button that calls `addGamesToWeek({year, week})` with loading state
- After any import action:
  - Re-fetch the relevant data (weeks or games)
  - Show MUI `Alert` (inline, not modal) for success or error feedback

File: `packages/frontend/src/components/admin/AdminSection.tsx`

### Step 7 — Tests

New file: `packages/backend/tests/routes/adminGames.test.ts`

Follow the pattern from `tests/routes/adminUsers.test.ts`:
- Create Hono app instance, seed test data, use JWT admin token.
- Mock `getGameData` and `getWeekData` from `src/api/index.ts` using `vi.mock()`.

Test cases:
1. `GET /admin/games` returns `[]` when no games in DB — assert no external API call made.
2. `GET /admin/games` returns stored games when they exist (use `createTestGame()` helper).
3. `POST /admin/week` calls external API and inserts returned games.
4. `POST /admin/week` called twice on same week → no duplicate rows (assert DB count stays the same).
5. `POST /admin/week` when external API returns `[]` → returns error response with message.

---

## Files to Modify

| File | Change |
|---|---|
| `packages/backend/src/db/schema/admin.ts` | Add unique constraint to `adminGames` |
| `packages/backend/src/db/dbAdminFunctions.ts` | Add `upsertGameForWeek()` |
| `packages/backend/src/routes/admin.ts` | Strip auto-load from GET routes; update POST /week |
| `packages/frontend/src/components/admin/AdminSection.tsx` | Handle empty states, import buttons, feedback |
| `packages/backend/tests/routes/adminGames.test.ts` | New test file |

---

## Verification

1. Run `pnpm generate && pnpm migrate` and `NODE_ENV=test pnpm migrate` after schema change.
2. Start backend (`pnpm dev:backend`) and frontend (`pnpm dev:frontend`).
3. Navigate to admin dashboard → Admin Controls tab.
4. Select a year that has not been seeded → verify "Load Weeks" button appears (not auto-populate).
5. Click "Load Weeks" → verify weeks populate and success feedback shows.
6. Select a week → verify "Import Games" button appears (no auto-load).
7. Click "Import Games" → verify games appear and success feedback shows.
8. Click "Re-import" → verify games refresh without duplicates in DB (check via `pnpm studio`).
9. Run `pnpm test:backend` — all tests including new adminGames tests should pass.
