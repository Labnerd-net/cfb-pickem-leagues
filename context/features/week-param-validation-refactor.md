# Plan: Week Param Validation Refactor

## Context

Query-parameter validation for year and week identifiers is currently done with manual `isNaN` / range-check guards repeated across `user.ts`, `leaderboard.ts`, and `admin.ts`. The existing `zValidate.ts` already has `yearSchema` and `weekSchema` primitives used for JSON body validation, but these are never applied to query params. Additionally, all routes expose the week query param as `?week=` while internal DB code consistently uses `weekNumber` — standardizing to `?weekNumber=` removes that inconsistency.

---

## Step 1 — Add query validators to `zValidate.ts`

**File:** `packages/backend/src/utils/zValidate.ts`

Add two new schemas using `z.coerce.number()` (required because query params arrive as strings):

```ts
const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
});

const weekIdentifierQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  weekNumber: z.coerce.number().int().min(1).max(52),
});
```

Export two new validators:
```ts
export const yearQueryValidator = zValidator('query', yearQuerySchema);
export const weekIdentifierQueryValidator = zValidator('query', weekIdentifierQuerySchema);
```

---

## Step 2 — Refactor `user.ts`

**File:** `packages/backend/src/routes/user.ts`

Import `yearQueryValidator` and `weekIdentifierQueryValidator` from `zValidate.js`.

| Route | Change |
|---|---|
| `GET /picks` (line 51) | Add `weekIdentifierQueryValidator` middleware; delete isNaN block; read `{ year, weekNumber }` from `c.req.valid('query')`; pass `{ year, week: weekNumber }` to `returnUserGames` |
| `GET /history` (line 66) | Add `yearQueryValidator`; delete isNaN block; read `{ year }` from `c.req.valid('query')` |
| `GET /weeks` (line 76) | Add `yearQueryValidator`; delete isNaN block; read `{ year }` from `c.req.valid('query')` |
| `GET /games` (line 86) | Add `weekIdentifierQueryValidator`; delete isNaN block; read `{ year, weekNumber }` from `c.req.valid('query')`; pass `{ year, week: weekNumber }` to DB functions |

---

## Step 3 — Refactor `admin.ts`

**File:** `packages/backend/src/routes/admin.ts`

Import `yearQueryValidator` and `weekIdentifierQueryValidator` from `zValidate.js`.

| Route | Change |
|---|---|
| `GET /weeks` (line 66) | Add `yearQueryValidator`; delete isNaN block; read from `c.req.valid('query')` |
| `GET /games` (line 105) | Add `weekIdentifierQueryValidator`; delete isNaN block; read `{ year, weekNumber }` and pass as `{ year, week: weekNumber }` to DB functions |

Note: `POST /year/:year` (line 49) uses a **path param**, not a query param — leave its manual check as-is, out of scope.

---

## Step 4 — Refactor `leaderboard.ts`

**File:** `packages/backend/src/routes/leaderboard.ts`

Import `yearQueryValidator` and `weekIdentifierQueryValidator` from `zValidate.js`.

| Route | Change |
|---|---|
| `GET /` (line 14) | Add `yearQueryValidator`; delete isNaN block; read from `c.req.valid('query')` |
| `GET /scores` (line 22) | Add `weekIdentifierQueryValidator`; delete isNaN block; read `{ year, weekNumber }` from `c.req.valid('query')`; pass directly to `returnWeekScores(year, weekNumber)` |

---

## Step 5 — Update frontend API callers

Rename `week: String(...)` → `weekNumber: String(...)` in query objects passed to the Hono RPC client. TypeScript will enforce this at compile time.

**File:** `packages/frontend/src/apis/userRequests.ts`
- `getUserPicks` (line 63): `week: String(weekData.week)` → `weekNumber: String(weekData.week)`
- `getPickedGames` (line 85): `week: String(weekData.week)` → `weekNumber: String(weekData.week)`

**File:** `packages/frontend/src/apis/adminRequests.ts`
- `getGamesForWeek` (line 83): `week: String(weekData.week)` → `weekNumber: String(weekData.week)`

**Note:** `leaderboardRequests.ts` only calls `GET /leaderboard` (year-only) — no change needed. `GET /leaderboard/scores` has no frontend caller yet.

---

## Step 6 — Update existing tests

**File:** `packages/backend/tests/routes/leaderboard.test.ts`
- Replace `?year=2024&week=1` → `?year=2024&weekNumber=1` (5 occurrences at lines 173, 179, 187, 195, 227)

**File:** `packages/backend/tests/routes/adminGames.test.ts`
- Replace `?year=2024&week=1` → `?year=2024&weekNumber=1` (2 occurrences at lines 50, 64)

---

## Verification

1. `pnpm build` — must pass with zero TypeScript errors (the RPC client will enforce query param names)
2. `pnpm test:backend` — all existing route tests must pass after the query param rename
3. Manual smoke test: hit `GET /api/user/picks?year=2024&week=1` — expect 400; hit with `?year=2024&weekNumber=1` — expect 200 or 404 (no data)
