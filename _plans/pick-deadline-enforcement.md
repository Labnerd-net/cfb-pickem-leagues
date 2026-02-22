# Plan: Pick Deadline Enforcement

## Context

Users can currently submit or change picks after a game has kicked off because `adminGames` has no `startTime` column, the shared types have no start time field, and `POST /picks` performs no deadline check. This adds `startTime` to the schema, populates it from all three external API adapters, enforces the deadline server-side, and surfaces locked state in the frontend pick card.

Decisions baked in from spec notes:
- `null` startTime → **block** picks (DB will be reset; no legacy rows to protect)
- Deadline = exact `startTime`, no buffer
- First locked game error only, with a hint to check other games
- `PICKS_IGNORE_DEADLINE=true` env var bypasses enforcement for off-season testing

---

## Step 1 — DB schema: add `startTime` column

**File: `packages/backend/src/db/schema/admin.ts`**

Add `timestamp('start_time')` (nullable, no default) to the `adminGames` table definition.

Then generate and run a migration:
```
cd packages/backend
pnpm generate   # creates migration file
pnpm migrate    # applies it
```

---

## Step 2 — Shared types: add `startTime` field

**File: `packages/shared/types/cfb-pickem-api.ts`**

Add `startTime: Date | null` to `AdminGameData`. `AdminDbGameData` extends `AdminGameData` so it inherits it automatically.

---

## Step 3 — Env var: debug bypass flag

**File: `packages/backend/src/utils/envVars.ts`**

Add:
```
export const ignorePickDeadline = process.env.PICKS_IGNORE_DEADLINE === 'true';
```

Document it in the backend `.env.example` / README comments alongside the other env vars.

---

## Step 4 — API adapters: populate `startTime`

**File: `packages/backend/src/api/index.ts`** — `getGameData()` function

Each adapter block sets `data.startTime`:

- **NCAA** (`dataSource === 'ncaa'`): use `game.game.startTimeEpoch` (already present in API response as a string Unix seconds, e.g. `"1755964800"`). Convert: `new Date(Number(game.game.startTimeEpoch) * 1000)`. If missing/falsy, set `null`.
- **CFBD** (`dataSource === 'cfbd'`): use `game.startDate` (ISO 8601 string e.g. `"2025-08-23T16:00:00.000Z"`). Convert: `new Date(game.startDate)`. If missing, set `null`.
- **SDV** (if/when implemented): same pattern — `new Date(game.startDate)`.

---

## Step 5 — DB insert: persist `startTime`

**File: `packages/backend/src/db/dbAdminFunctions.ts`** — the `addGame()` / upsert function

Include `startTime: game.startTime` in the `.values({...})` call and in the `onConflictDoUpdate` `set` block so re-imports overwrite stale start times.

Also update `returnUserGames()` in `dbUserFunctions.ts` — the join query explicitly lists selected columns. Add `startTime: adminGames.startTime` to that select so it flows through to the frontend.

---

## Step 6 — Route: enforce deadline in `POST /picks`

**File: `packages/backend/src/routes/user.ts`** — `.post('/picks', ...)` handler

Before the existing loop that calls `addPickedGame`, add a pre-flight check:

1. Import `ignorePickDeadline` from `envVars`.
2. If `ignorePickDeadline` is false, for each `pick.game` in the request:
   - Call the existing `dbAdminFunctions.returnGame(pick.game)` (already used by `addPickedGame` internally — call it here first at the route level to avoid re-querying inside the loop).
   - If game not found → 404.
   - If `game.startTime === null` → block, return 422 with message: `"Game <id> has no start time set and cannot accept picks."`.
   - If `new Date() >= game.startTime` → block, return 422 with message: `"Game <id> (<away> @ <home>) is locked — kickoff has passed. Check your other picks too."`.
3. Only if all games pass the check, proceed with the existing `addPickedGame` loop.

Return 422 (Unprocessable Entity) for deadline violations — not 400, since the request is syntactically valid but logically rejected.

---

## Step 7 — Frontend: locked state on pick card

**File: `packages/frontend/src/components/user/UserPicksGameCard.tsx`**

- `game` prop is `AdminDbGameData` which now has `startTime: Date | null`.
- Derive `isLocked = game.startTime !== null && new Date() >= new Date(game.startTime)`.
- Pass `disabled={isLocked}` to the `<RadioGroup>` and both `<FormControlLabel>` / `<Radio>` elements.
- Display start time below the matchup line using `toLocaleString()` (browser local timezone). If `startTime` is null, show "Start time TBD".
- When `isLocked`, show a "LOCKED" chip/badge (similar to the existing "SAVED" badge pattern) and apply a muted visual style (e.g. reduced opacity or grey border).

**File: `packages/frontend/src/components/user/UserPicksGamesList.tsx`**

No structural change needed — the card handles its own locked state. Verify the `onSubmit` handler still works correctly when some cards are locked (locked games simply won't have picks changed).

---

## Step 8 — Tests

**New file: `packages/backend/tests/unit/routes/picks-deadline.test.ts`**

Use the existing route test pattern (Hono `app` + test DB, see `packages/backend/tests/unit/` for examples). Mock or use real DB rows.

- Pick accepted when `now < startTime`.
- Pick rejected (422) when `now >= startTime`; response mentions the game.
- Pick rejected (422) when `startTime` is `null`.
- Mixed batch (one past deadline, one valid) → rejected on first locked game.
- `PICKS_IGNORE_DEADLINE=true` → all picks accepted regardless of startTime.

**New file: `packages/frontend/tests/unit/components/UserPicksGameCard.test.tsx`**

- Renders interactive radios when `startTime` is in the future.
- Renders disabled radios and "LOCKED" badge when `startTime` is in the past.
- Displays start time string on the card.
- Displays "Start time TBD" when `startTime` is null.

---

## Files changed

### Modified
- `packages/backend/src/db/schema/admin.ts` — add `startTime` column
- `packages/backend/src/utils/envVars.ts` — add `ignorePickDeadline`
- `packages/shared/types/cfb-pickem-api.ts` — add `startTime` to `AdminGameData`
- `packages/backend/src/api/index.ts` — populate `startTime` in all adapter branches
- `packages/backend/src/db/dbAdminFunctions.ts` — persist `startTime` on insert/upsert
- `packages/backend/src/db/dbUserFunctions.ts` — include `startTime` in join select
- `packages/backend/src/routes/user.ts` — deadline check before `addPickedGame` loop
- `packages/frontend/src/components/user/UserPicksGameCard.tsx` — locked state + start time display

### New
- `packages/backend/src/db/migrations/<timestamp>_add_start_time.sql` (generated)
- `packages/backend/tests/unit/routes/picks-deadline.test.ts`
- `packages/frontend/tests/unit/components/UserPicksGameCard.test.tsx`

---

## Verification

1. `pnpm generate && pnpm migrate` — migration runs cleanly.
2. `npx tsc --noEmit -p packages/backend/tsconfig.json` — no errors.
3. `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` — no errors.
4. Import games for a week → confirm `startTime` is non-null in Drizzle Studio.
5. Submit a pick for a future game → 200.
6. Manually set a game's `start_time` to a past timestamp in DB → submit pick → 422 with lock message.
7. Set `PICKS_IGNORE_DEADLINE=true` in `.env` → pick for past-start-time game accepted.
8. Frontend: pick card for past-start-time game shows "LOCKED", radios disabled.
9. `pnpm test` — all tests pass including new ones.
