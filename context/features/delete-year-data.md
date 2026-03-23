# Delete Year Data — Implementation Plan

## Overview

Add a `DELETE /admin/year/:year` endpoint and a "Reset Year" button in the admin panel. The endpoint checks for existing user picks against any game in the year and returns 409 if any are found. If none, it deletes all `admin.games` for the year first (to satisfy the `user.games → admin.games` RESTRICT FK), then all `admin.weeks`.

The feature is destructive and irreversible. The UI enforces a confirmation dialog before calling the endpoint.

---

## Files to Modify

1. `packages/backend/src/db/dbAdminFunctions.ts` — Add three new DB functions
2. `packages/backend/src/routes/admin.ts` — Add DELETE route handler
3. `packages/frontend/src/apis/adminRequests.ts` — Add `deleteYear` API function
4. `packages/frontend/src/components/admin/useWeekManagement.ts` — Add `deleteYear` method to hook
5. `packages/frontend/src/components/admin/AdminSection.tsx` — Add "Reset Year" button and confirmation dialog

### Test files to create/modify

6. `packages/backend/tests/db-utils.ts` — Add `createTestPick` helper
7. `packages/backend/tests/routes/adminDeleteYear.test.ts` — New test file

---

## Step-by-Step Implementation

### Step 1 — DB Layer (`packages/backend/src/db/dbAdminFunctions.ts`)

Import `games` from `./schema/users.js` aliased as `userGames` (avoids name collision with `adminGames` already in scope).

**Add `hasPicksForYear(year: number): Promise<boolean>`**

Join `userGames` with `adminGames` on `userGames.gameId = adminGames.gameId` where `adminGames.year = year`. Use `.limit(1)` and return `true` if the result array is non-empty. Avoids a full count scan.

**Add `deleteGamesForYear(year: number): Promise<void>`**

`db.delete(adminGames).where(eq(adminGames.year, year))`. Wrap in try/catch with logger.error, consistent with existing patterns in the file.

**Add `deleteWeeksForYear(year: number): Promise<void>`**

`db.delete(adminWeeks).where(eq(adminWeeks.year, year))`. Same pattern. Games must already be gone before this runs.

---

### Step 2 — Route (`packages/backend/src/routes/admin.ts`)

Add `.delete('/year/:year', apiRateLimit, authMiddleware, requireRole('admin'), async c => {...})` immediately after the existing `.post('/year/:year', ...)` block.

**Year validation:** Reuse the exact pattern from the POST handler:
```
const yearNumber = Number(c.req.param('year'));
if (isNaN(yearNumber) || yearNumber < 1900 || yearNumber > 2100)
  throw new HTTPException(400, { message: 'year must be between 1900 and 2100' });
```

**Logic (in order):**
1. Call `dbAdminFunctions.hasPicksForYear(yearNumber)`.
2. If `true`, throw `new HTTPException(409, { message: 'Cannot delete year: user picks exist for this season' })`.
3. Call `dbAdminFunctions.deleteGamesForYear(yearNumber)`.
4. Call `dbAdminFunctions.deleteWeeksForYear(yearNumber)`.
5. Return `c.json({ status: 'deleted' })`.

---

### Step 3 — Frontend API (`packages/frontend/src/apis/adminRequests.ts`)

Add `DeleteYearResponse` interface (same shape as other response interfaces in the file):

```ts
export interface DeleteYearResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}
```

Add `deleteYear(year: number): Promise<DeleteYearResponse>` using the Hono RPC client:

```ts
client.api.admin.year[':year'].$delete({ param: { year: String(year) } })
```

On non-ok responses, read `body.error` and return `{ success: false, error: body.error }`. The 409 error message from the backend is descriptive enough for display.

---

### Step 4 — Frontend Hook (`packages/frontend/src/components/admin/useWeekManagement.ts`)

**Extend `UseWeekManagementReturn` interface** with:

```ts
deleteYear: (callbacks: ImportWeeksCallbacks) => Promise<void>;
```

**Add `deleteYear` function inside the hook** accepting the same `ImportWeeksCallbacks` shape as `importWeeks` (so the same `setImporting` / `setImportFeedback` callbacks from `AdminSection` can be passed through). On success:
- Call `setWeeks([])`.
- Call `setSelectedWeek(1)`.
- Call `setImportFeedback({ severity: 'success', message: `Season ${selectedYear} data deleted` })`.

On failure: `setImportFeedback({ severity: 'error', message: result.error ?? 'Failed to delete year data' })`.

Return `deleteYear` from the hook.

---

### Step 5 — Frontend UI (`packages/frontend/src/components/admin/AdminSection.tsx`)

**New local state:**
- `resetDialogOpen: boolean` — controls Dialog visibility
- `resetting: boolean` — disables Confirm while request is in flight

**"Reset Year" Button:**

Add in the `weekHook.weeks.length > 0` block, alongside the existing "Re-import" button row (`Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}`). Use `variant="outlined"` and `color="error"`. Disabled while `loading || importing || resetting`.

**MUI `Dialog` confirmation:**

Add `Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions` to the MUI import line.

- Title: `Reset {weekHook.selectedYear} Season?`
- Body: `This will permanently delete all weeks and games for {weekHook.selectedYear}. This action cannot be undone.`
- Cancel: closes dialog, no side effects.
- Confirm: `color="error"`, disabled while `resetting`, shows `CircularProgress` when `resetting`.

**On confirm:**
1. Set `resetting = true`.
2. Call `weekHook.deleteYear({ setImporting: setResetting, setImportFeedback: gameHook.setImportFeedback })`.
3. Close dialog after call returns.

The existing `importFeedback` alert already renders above the week selector — no new alert component needed.

---

### Step 6 — Tests

**`packages/backend/tests/db-utils.ts`** — Add `createTestPick(userId: number, gameId: number)`:

```ts
INSERT INTO "user"."games" (user_id, game_id, team_chosen)
VALUES (userId, gameId, 'home_team')
ON CONFLICT (user_id, game_id) DO NOTHING
```

**`packages/backend/tests/routes/adminDeleteYear.test.ts`** — New file, modelled after `adminGames.test.ts`.

Test cases:

1. **400** — `DELETE /api/admin/year/abc` (non-numeric year).
2. **400** — `DELETE /api/admin/year/1800` (year out of range).
3. **401** — No auth cookie.
4. **403** — Non-admin JWT.
5. **200 (no data)** — Year not in DB returns 200 `{ status: 'deleted' }`.
6. **200 (cleans up)** — Seed week + game via `createTestWeek` / `createTestGame`. Call endpoint. Assert both rows gone via DB query.
7. **409 (picks exist)** — Seed week + game + pick via `createTestPick`. Call endpoint. Assert 409 and rows still exist.

---

## Notes and Pitfalls

- **Deletion order is critical.** `user.games → admin.games` is RESTRICT. Deleting `admin.weeks` first would cascade to `admin.games`, which would hit the RESTRICT FK if picks exist. The `hasPicksForYear` check is the safety gate, but deletion order (games first, weeks second) must still be respected.
- **`userGames` import alias.** The users schema exports `games` (not `userGames`). Import as `import { games as userGames } from './schema/users.js'` to avoid shadowing `adminGames`.
- **Prefer `.limit(1)` over `count`** in `hasPicksForYear` — keeps imports minimal and short-circuits on first match.
- **`resetting` vs `importing` state.** Keep them separate. `importing` is owned by `gameHook`; a local `resetting` state in `AdminSection` avoids coupling.
- **Dialog MUI imports.** `Dialog` and related components are not in the current `AdminSection.tsx` imports — must be added.
