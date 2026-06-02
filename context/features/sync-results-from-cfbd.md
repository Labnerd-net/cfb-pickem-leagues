# Plan: Sync Results from CFBD

## Context

The current "mark game complete" flow requires manual score entry — platform admins use `POST /admin/games/complete` to mark individual games with scores, and league admins use `POST /admin/leagues/:leagueId/games/complete` to bulk-finalize a week. This exists because there's no mechanism to re-fetch results from CFBD after games are played.

The problem: the bulk league endpoint writes global game state (`completed`, scores, `winningTeam` on `admin.games`) which affects every league. This is a privilege issue — league admins shouldn't write global facts.

The fix: add a platform-admin-only "Sync Results" action that re-runs the CFBD import for a week. Games that finished in CFBD flip to `completed = true` automatically. Games with correction audit entries are skipped. After sync, any league whose full pool is now complete gets a `rankings_updated` notification via the existing deduplication system. Remove both manual mark-complete endpoints.

---

## Implementation Steps

### 1. Backend — DB helper: `getCorrectedCfbdGameIds`

Add to `packages/backend/src/db/dbAdminFunctions.ts`:

```
getCorrectedCfbdGameIds(year: number, weekNumber: number): Promise<Set<number>>
```

Query: join `admin_games` ↔ `score_corrections` where `admin_games.year = year AND admin_games.weekNumber = weekNumber`. Return a `Set<number>` of `cfbdGameId` values. This lets the sync route check each CFBD result by `cfbdGameId` directly — no secondary lookup needed.

---

### 2. Backend — New sync route: `POST /admin/weeks/sync-results`

Add to `packages/backend/src/routes/admin.ts`, platform admin only (`requireRole('admin')`).

**Input:** `weekIdentifierQueryValidator` (year + weekNumber query params — same as existing game/week endpoints)

**Logic:**
1. Enrich the week identifier — look up `seasonType` from DB and compute original CFBD week for postseason (reuse the same logic as the existing `POST /week` import route, which calls `enrichWeekIdentifier` and `getMaxRegularWeek`)
2. Call `getGameData(enrichedQuery, 'fbs', cfbdWeek?)` — same CFBD fetch used by import
3. If CFBD returns 0 games → 422 error
4. Call `getCorrectedCfbdGameIds(year, weekNumber)` to get the skip set
5. For each game from CFBD:
   - If `correctedIds.has(game.cfbdGameId)` → skip (increment skipped count)
   - Otherwise call `upsertGameForWeek(game)` and count if `game.completed` is true (increment updated count)
6. After all upserts, call `getActiveLeaguesForWeek(year, weekNumber)` — already in `dbNotificationFunctions.ts`
7. For each league: call `getGamesForLeagueWeek(leagueId, year, weekNumber)` and check `isWeekComplete()`. If complete, dispatch `dispatchGameComplete(leagueId, year, weekNumber)` via `waitUntil`. The existing `notification_log` unique constraint handles deduplication — no double-sends even if sync is run multiple times.
8. Return `{ gamesChecked, gamesUpdated, gamesSkippedDueToCorrection, leaguesNotified }`

---

### 3. Backend — Remove `POST /admin/games/complete`

Remove from `admin.ts`:
- `POST /games/complete` route
- `markGameCompleteValidator` from the zValidate import

Remove from `dbAdminFunctions.ts`:
- `markGameComplete` function (export)

Remove from `zValidate.ts`:
- `markGameCompleteValidator` / `markGameCompleteSchema`

---

### 4. Backend — Remove `POST /admin/leagues/:leagueId/games/complete`

Remove route from `adminLeagues.ts`. Also remove `markGameComplete` import and any now-unused imports (`isWeekComplete`, `dispatchGameComplete`, `waitUntil`, `logger`) — verify each before removing.

---

### 5. Frontend — Add `syncWeekResults` to `adminRequests.ts`

```typescript
export interface SyncWeekResultsResponse {
  success: boolean;
  data?: { gamesChecked: number; gamesUpdated: number; gamesSkipped: number; leaguesNotified: number };
  error?: string;
}

export async function syncWeekResults(year: number, weekNumber: number): Promise<SyncWeekResultsResponse>
// Endpoint: POST /api/admin/weeks/sync-results?year=...&weekNumber=...
```

Remove `markGameComplete` and `markLeagueWeekComplete` functions and their types.

---

### 6. Frontend — Add "Sync Results" button to `AdminSection`

In `packages/frontend/src/components/admin/AdminSection.tsx`, add a "Sync Results" button alongside the existing week action buttons (near the import games area). The button:
- Is only enabled when a week is selected and games are loaded
- Shows a spinner and "Syncing..." while in-flight
- On success: shows snackbar with summary ("X games updated, Y leagues notified")
- On error: shows error snackbar
- After success: calls the existing `loadGames()` to refresh the game list

---

### 7. Frontend — Remove `MarkCompleteCard`

- Delete `packages/frontend/src/components/admin/MarkCompleteCard.tsx`
- Remove its import and usage from `AdminSection.tsx`

---

### 8. Frontend — Remove "Mark Week Complete" from `LeagueAdminSection`

- Remove the button and handler
- Remove `completing` state
- Remove `markLeagueWeekComplete` import

---

### 9. Shared Types — Add sync response type

Add `SyncWeekResultsSummary` to `packages/shared/types/cfb-pickem-api.ts` if needed for backend response typing. Alternatively keep it backend-local.

---

## Files Modified

- `packages/backend/src/db/dbAdminFunctions.ts` — add `getCorrectedCfbdGameIds`; remove `markGameComplete`
- `packages/backend/src/routes/admin.ts` — add `POST /weeks/sync-results`; remove `POST /games/complete`
- `packages/backend/src/routes/adminLeagues.ts` — remove `POST /:leagueId/games/complete`; clean up now-unused imports
- `packages/backend/src/utils/zValidate.ts` — remove `markGameCompleteValidator`
- `packages/frontend/src/apis/adminRequests.ts` — add `syncWeekResults`; remove `markGameComplete`, `markLeagueWeekComplete`
- `packages/frontend/src/components/admin/AdminSection.tsx` — add Sync Results button; remove MarkCompleteCard
- `packages/frontend/src/components/admin/MarkCompleteCard.tsx` — delete
- `packages/frontend/src/components/admin/LeagueAdminSection.tsx` — remove Mark Week Complete button and handler

---

## Verification

1. `npx tsc --noEmit` on both backend and frontend — no type errors
2. `pnpm test:backend` — existing tests pass; add new tests for:
   - `POST /admin/weeks/sync-results` returns 403 for non-admin
   - Sync skips games with correction audit entries
   - Sync returns 422 when CFBD returns no games
   - `rankings_updated` is dispatched for leagues that become complete
3. Manually: import a week, run sync, verify games flip to completed and snackbar shows correct summary
