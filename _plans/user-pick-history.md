# Plan: User Pick History Endpoint

## Context

Users can only retrieve picks one week at a time via `GET /user/picks?year=&week=`. There is no way to see a season-level summary. This adds `GET /user/history?year=` which returns per-week pick counts (total, correct, incorrect, pending) for a given year. Spec: `_specs/user-pick-history.md`.

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/shared/types/cfb-pickem-api.ts` | Add `UserPickHistoryEntry` and `UserPickHistoryResponse` types |
| `packages/backend/src/db/dbUserFunctions.ts` | Add `returnUserPickHistory()` DB function |
| `packages/backend/src/routes/user.ts` | Add `GET /history` route |
| `packages/frontend/src/apis/userRequests.ts` | Add `getUserPickHistory(year)` API function |
| `packages/backend/tests/routes/userHistory.test.ts` | New test file |

---

## Step 1 — Shared Types (`packages/shared/types/cfb-pickem-api.ts`)

Add two types at the bottom of the file:

```ts
export interface UserPickHistoryEntry {
  year: number;
  weekNumber: number;
  total: number;
  correct: number;
  incorrect: number;
  pending: number;
}

export interface UserPickHistoryResponse {
  history: UserPickHistoryEntry[];
}
```

---

## Step 2 — DB Function (`packages/backend/src/db/dbUserFunctions.ts`)

Add `returnUserPickHistory(year: number, userId: string): Promise<UserPickHistoryEntry[]>`.

Use a single Drizzle query with `groupBy` on `(year, weekNumber)` and conditional `sql` counts:

- **correct**: `COUNT(CASE WHEN winningTeam != 'pending' AND winningTeam = teamChosen THEN 1 END)`
- **incorrect**: `COUNT(CASE WHEN winningTeam != 'pending' AND winningTeam != teamChosen THEN 1 END)`
- **pending**: `COUNT(CASE WHEN winningTeam = 'pending' THEN 1 END)`
- **total**: `COUNT(*)`

Join `games` (user schema) → `adminGames` (admin schema) on `gameId`, filter by `year` and `userId`, order by `weekNumber DESC`.

Use the existing `sql` import pattern already in the file (it already imports from `drizzle-orm`). The `count()` aggregates with `sql` expressions can be done with `sql<number>` template literals, consistent with how the project uses Drizzle raw SQL.

Import `UserPickHistoryEntry` from shared types.

---

## Step 3 — Route (`packages/backend/src/routes/user.ts`)

Add after the `GET /weeks` handler:

```
GET /history
- Middleware: apiRateLimit, authMiddleware
- Query param: year (integer, validated 1900–2100, same pattern as other routes)
- Extracts userId from jwtPayload.sub
- Calls returnUserPickHistory(year, userId)
- Returns c.json({ history })
```

No 404 on empty — returns `{ history: [] }` per spec.

---

## Step 4 — Frontend API Function (`packages/frontend/src/apis/userRequests.ts`)

Add `getUserPickHistory(year: number)`:

- Method: GET via `client.api.user.history.$get({ query: { year: String(year) } })`
- Return type follows the existing pattern in the file: `{ success, data?, error? }`
- Cast response as `UserPickHistoryResponse`

Import `UserPickHistoryResponse` from shared types.

---

## Step 5 — Tests (`packages/backend/tests/routes/userHistory.test.ts`)

Follow the pattern in `packages/backend/tests/routes/auth.test.ts`:
- Create a Hono app, mount `user` routes at `/api/user`, add error handler
- Use `seedTestData()` / `cleanDatabase()` from existing test helpers
- Seed picks and game results manually using `addPickedGame()` and raw SQL to set `winningTeam`/`completed` on admin games

Test cases:
1. Returns `{ history: [] }` for a user with no picks
2. Returns correct week summaries with accurate correct/incorrect counts when games are completed
3. Pending count is correct when games have `winningTeam = 'pending'`
4. Returns 401 when no auth token is provided
5. Returns 400 for invalid year (e.g., `year=abc`)

---

## Correct/Incorrect Logic

A pick is:
- **correct** — `winningTeam !== 'pending'` AND `winningTeam === teamChosen`
- **incorrect** — `winningTeam !== 'pending'` AND `winningTeam !== teamChosen`
- **pending** — `winningTeam === 'pending'`

This matches how existing score display works (null homePoints/awayPoints → game not finished).

---

## Verification

1. Run `pnpm test:backend` — new test file should pass
2. `npx tsc --noEmit -p packages/backend/tsconfig.json` — no type errors
3. `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` — no type errors
4. Manual: `GET /api/user/history?year=2024` with valid auth cookie returns expected shape
