# Plan: CFBD-Only Data Source with Spread Support

## Context

The NCAA API adapter was never well-suited for this app — it lacks postseason game support and provides no betting lines. CFBD already handles postseason properly (postseason weeks are renumbered continuously after regular season). Removing NCAA simplifies the entire data layer (no conditional branches, no dead adapter), and unlocks adding spread data since CFBD exposes a `getLines` endpoint.

Spread will be admin-only display (per spec answers). Just the number, no provider name stored.

---

## Step 1: Remove NCAA API adapter

**Delete:** `packages/backend/src/api/ncaa-api.ts`

---

## Step 2: Update `envVars.ts`

**File:** `packages/backend/src/utils/envVars.ts`

- Remove `DATA_SOURCE` from Zod schema (remove the `z.enum(['ncaa', 'cfbd'])` field)
- Remove the `superRefine` cross-field check entirely
- Change `CFBD_API_KEY` from `z.string().optional()` to `z.string().min(1, 'CFBD_API_KEY is required')`
- Remove `export const dataSource`
- `cfbdApiKey` no longer needs the `?? ''` fallback (it's required now)
- Update CLAUDE.md env var table: remove DATA_SOURCE row, change CFBD_API_KEY note to "required"

---

## Step 3: Add `getCfbdLinesData` to `cfbd.ts`

**File:** `packages/backend/src/api/cfbd.ts`

Add a new export function `getCfbdLinesData(query: WeekQuery)`:
```ts
import { client, getGames, getCalendar, getLines } from 'cfbd';
// ...
export async function getCfbdLinesData(query: WeekQuery) {
  const linesData = await getLines({
    query: { year: query.year, week: query.week, seasonType: query.seasonType },
  });
  return linesData.data;
}
```

Returns `BettingGame[]` where each entry has `id` (CFBD game ID) and `lines: GameLine[]`. `GameLine.spread` is `number | null`, `GameLine.provider` is a string (consensus line has `provider === 'consensus'`).

---

## Step 4: Update `api/index.ts`

**File:** `packages/backend/src/api/index.ts`

### `getWeekData`
- Remove the `else if (dataSource === 'ncaa')` branch entirely
- Remove the `ncaa` imports (`getNcaaSchedule`, `getNcaaScoreboard`)
- Remove `dataSource` import from envVars
- The function body becomes just the CFBD block (no conditional)

### `getGameData`
- Call `getCfbdGameData` and `getCfbdLinesData` in parallel with `Promise.all`
- Build a spread lookup Map: `Map<cfbdGameId, number | null>`
  - For each `BettingGame`: find the line where `provider === 'consensus'`, fall back to `lines[0]`, otherwise `null`
- In the game loop, add `data.spread = linesMap.get(game.id) ?? null`
- Remove `dataSource` conditional and the `ncaa` branch
- Add `spread: number | null` to `AdminGameData` construction

---

## Step 5: Update shared types

**File:** `packages/shared/types/cfb-pickem-api.ts`

- Remove `ncaaGameId: string | null` from `AdminGameData`, `UserGameData`
- Add `spread: number | null` to `AdminGameData`
- Remove `DataSource` type (no longer used — was `"ncaa" | "cfbd" | "sdv"`)

---

## Step 6: Update DB schema + generate migration

**File:** `packages/backend/src/db/schema/admin.ts`

- Remove `ncaaGameId: text('ncaa_game_id')` column
- Add `spread: real('spread')` column (nullable, no default)

Run `pnpm generate` to create a new migration file, then `pnpm migrate`.

Expected migration SQL:
```sql
ALTER TABLE "admin"."games" DROP COLUMN "ncaa_game_id";
ALTER TABLE "admin"."games" ADD COLUMN "spread" real;
```

---

## Step 7: Update `dbAdminFunctions.ts`

**File:** `packages/backend/src/db/dbAdminFunctions.ts`

In `upsertGameForWeek`:
- Remove `ncaaGameId: game.ncaaGameId` from `.values({...})` insert
- Add `spread: game.spread` to both `.values({...})` and `.onConflictDoUpdate({ set: {...} })`
  - Spread should update on re-import (lines data may improve over time)

All `SELECT`-based functions (`returnGamesForWeek`, `returnGame`, `returnGamesBulk`, `returnPickedGames`) use `db.select().from(adminGames)` which automatically picks up all columns — no changes needed there.

---

## Step 8: Update frontend `GameCard.tsx`

**File:** `packages/frontend/src/components/admin/GameCard.tsx`

After the "Week N • seasonType" line, add a conditional spread display:
```tsx
{game.spread !== null && (
  <Typography variant="body2" sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary', fontSize: '0.875rem' }}>
    Spread: {game.spread > 0 ? `+${game.spread}` : game.spread} (home)
  </Typography>
)}
```

No changes to user-facing components (`UserPicksGameCard.tsx`, `WeekResultsGameRow.tsx`) — spread is admin-only per spec.

---

## Step 9: Update tests

### `packages/backend/tests/unit/utils/envVars.test.ts`
- Update `minimalValid` to `{ JWT_SECRET: 'supersecret', CFBD_API_KEY: 'testkey' }` (remove `DATA_SOURCE`)
- Remove tests: "passes when DATA_SOURCE=ncaa and CFBD_API_KEY is missing", "throws when DATA_SOURCE=cfbd and CFBD_API_KEY is missing", "throws when DATA_SOURCE is an invalid value"
- Replace with: "throws when CFBD_API_KEY is missing", "passes when CFBD_API_KEY is provided"

### `packages/backend/tests/unit/api/converters.test.ts`
- Remove `vi.mock('../../../src/api/ncaa-api.js', ...)` mock block
- Remove the `getWeekData - NCAA` describe block (2 tests)
- Remove `dataSource` from all `vi.doMock('../../../src/utils/envVars.js', ...)` calls
- Add new tests in `getGameData - CFBD` describe block:
  - "spread is taken from consensus line when available"
  - "spread falls back to first line when no consensus"
  - "spread is null when lines array is empty"

### New file: `packages/backend/tests/unit/api/cfbd.test.ts` (optional — if mocking CFBD client is straightforward)
- Can skip this if the lines logic is fully covered by converters.test.ts

---

## File Change Summary

| File | Action |
|------|--------|
| `packages/backend/src/api/ncaa-api.ts` | DELETE |
| `packages/backend/src/api/cfbd.ts` | Add `getCfbdLinesData` |
| `packages/backend/src/api/index.ts` | Remove NCAA branch, add parallel lines fetch, add spread mapping |
| `packages/backend/src/utils/envVars.ts` | Remove DATA_SOURCE, make CFBD_API_KEY required |
| `packages/backend/src/db/schema/admin.ts` | Remove ncaaGameId, add spread |
| `packages/backend/src/db/dbAdminFunctions.ts` | Remove ncaaGameId, add spread to upsert |
| `packages/shared/types/cfb-pickem-api.ts` | Remove ncaaGameId, DataSource; add spread |
| `packages/frontend/src/components/admin/GameCard.tsx` | Display spread |
| `packages/backend/tests/unit/utils/envVars.test.ts` | Update for new env validation |
| `packages/backend/tests/unit/api/converters.test.ts` | Remove NCAA tests, add spread tests |
| `CLAUDE.md` | Update env var table |
| New migration file (auto-generated) | Drop ncaa_game_id, add spread |

---

## Verification

1. `pnpm build` — no TypeScript errors
2. `pnpm test:backend` — all tests pass including updated envVars and converters tests
3. Start backend; import a week via `POST /api/admin/week` — verify spread populated in DB via Drizzle Studio
4. Load admin game view — verify spread displayed on game cards where available, nothing shown when null
5. Verify user picks view is unchanged (no spread shown)
