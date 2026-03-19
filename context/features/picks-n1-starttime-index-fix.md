# Plan: Picks N+1 Query and Start Time Index Performance Fix

## Context

Two performance issues from the backlog ([15] and [19]):

1. **[15]** `POST /user/picks` validates each submitted pick by calling `returnGame(pick.game)` in a for loop — one SELECT per pick. For 10 games, that's 10 round trips before a single write. The fix is a single bulk SELECT using `inArray`. Additionally, `addPickedGame` (the single-pick DB function) has its own redundant `returnGame` call that should be removed per the backlog.

2. **[19]** `admin.games.startTime` has no index. Deadline enforcement in the picks route queries this column, and the cron job also uses it. Adding an index is a trivial schema + migration change.

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/backend/src/db/dbAdminFunctions.ts` | Add `returnGamesBulk(gameIds: number[])` using `inArray` |
| `packages/backend/src/routes/user.ts` | Replace N `returnGame` calls with one `returnGamesBulk` call + Map lookup |
| `packages/backend/src/db/dbUserFunctions.ts` | Remove redundant `returnGame` call inside `addPickedGame` |
| `packages/backend/src/db/schema/admin.ts` | Add `index('games_start_time_idx').on(table.startTime)` |
| `packages/backend/tests/unit/db/dbAdminFunctions.test.ts` | Add tests for `returnGamesBulk` |
| `packages/backend/tests/unit/db/dbUserFunctions.test.ts` | Update `addPickedGame` non-existent game test (no longer calls `returnGame` internally) |

---

## Implementation Steps

### Step 1: Add `returnGamesBulk` to `dbAdminFunctions.ts`

After the existing `returnGame` function, add:

```ts
export async function returnGamesBulk(gameIds: number[]): Promise<AdminDbGameData[]> {
  if (gameIds.length === 0) return [];
  return await db.select().from(adminGames).where(inArray(adminGames.gameId, gameIds));
}
```

- Uses `inArray` (already imported for `setPickedGames`)
- Returns empty array for empty input — prevents invalid `inArray` call
- Returns all matched rows; missing IDs simply produce no row (caller handles via Map lookup)

### Step 2: Update `user.ts` validation loop

Replace:
```ts
for (const pick of userPicks.games) {
  const gameRows = await returnGame(pick.game);
  ...
  const game = gameRows[0];
  // validate game.picked, game.startTime
}
```

With:
```ts
// Fetch all games in a single query
const gameRows = await returnGamesBulk(gameIds);
const gameMap = new Map(gameRows.map(g => [g.gameId, g]));

for (const pick of userPicks.games) {
  const game = gameMap.get(pick.game);
  if (!game) throw new HTTPException(404, { message: `Game ${pick.game} not found` });
  // same picked / deadline validation as before
}
```

Update import to use `returnGamesBulk` instead of (or in addition to) `returnGame`.

### Step 3: Remove redundant `returnGame` call from `addPickedGame`

In `dbUserFunctions.ts` lines 168–174, remove the `returnGame` call and its existence/count checks. The function's job is to insert — callers are responsible for pre-validating game existence. The function already has an outer `try/catch` that propagates errors.

### Step 4: Add `startTime` index to schema

In `packages/backend/src/db/schema/admin.ts`, inside the `adminGames` table definition's index block, add:

```ts
index('games_start_time_idx').on(table.startTime),
```

Then run:
```
cd packages/backend && pnpm generate && pnpm migrate
```

---

## Test Changes

### New tests in `tests/unit/db/dbAdminFunctions.test.ts`

- `returnGamesBulk` with all valid IDs → returns all rows
- `returnGamesBulk` with some non-existent IDs → returns only matched rows (missing IDs silently absent)
- `returnGamesBulk` with empty array → returns `[]` without error

### Update `tests/unit/db/dbUserFunctions.test.ts`

- The test at ~line 144 testing `addPickedGame` with a non-existent game ID currently expects an error thrown from the internal `returnGame` call. After the change, that call is removed — the insert will fail at the DB level (FK violation) instead. Update the test to still expect an error (just a different origin), or seed a non-existent foreign key and confirm the error is thrown.

### No changes needed

- `tests/routes/userPicks.test.ts` — tests against real DB, behavior unchanged

---

## Verification

1. `pnpm build` — no TypeScript errors
2. `pnpm test:backend` — all existing tests pass, new tests pass
3. Manual: submit picks for a week with 10 games; confirm single SELECT in DB logs (if debug logging is on)
4. Confirm migration applied: `pnpm studio` or `psql` to verify `games_start_time_idx` exists
