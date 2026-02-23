# Plan: Leaderboard and Scoring

## Context

The app has no way to determine who is winning the pick'em game. Users can submit picks and view their own history, but there is no cross-user standings view. This adds two endpoints under a new `/api/leaderboard/` route: season-level standings and per-week pick results across all users.

## Files to Create

- `packages/backend/src/routes/leaderboard.ts` — new Hono route handler
- `packages/backend/tests/routes/leaderboard.test.ts` — integration tests

## Files to Modify

- `packages/shared/types/cfb-pickem-api.ts` — add `LeaderboardEntry` and `WeekScoresEntry` types
- `packages/backend/src/db/dbUserFunctions.ts` — add `returnLeaderboard()` and `returnWeekScores()`
- `packages/backend/src/index.ts` — register `/api/leaderboard` route

---

## Step 1: Add shared types

In `packages/shared/types/cfb-pickem-api.ts`, append:

```ts
export interface LeaderboardEntry {
  userId: number;
  displayName: string;
  total: number;
  correct: number;
  incorrect: number;
  pending: number;
  percentage: number | null; // null when total === 0
}

export interface WeekScoresEntry {
  userId: number;
  displayName: string;
  total: number;
  correct: number;
  incorrect: number;
  pending: number;
}
```

---

## Step 2: Add DB functions in `dbUserFunctions.ts`

### `returnLeaderboard(year: number): Promise<LeaderboardEntry[]>`

Cross-join all users (LEFT JOIN) against picks + admin games for the given year. Using `LEFT JOIN` on both sides ensures users with zero picks still appear. The year filter goes in the `adminGames` join condition — **not** the WHERE clause — so zero-pick users are not filtered out.

Key: use `COUNT(adminGames.gameId)` (not `COUNT(games.gameId)`) for `total` so picks from other years don't inflate the count.

```ts
db.select({
  userId: users.userId,
  displayName: users.displayName,
  total: sql<number>`COUNT(${adminGames.gameId})`,
  correct: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} != 'pending' AND ${adminGames.winningTeam} = ${games.teamChosen} THEN 1 END)`,
  incorrect: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} != 'pending' AND ${adminGames.winningTeam} != ${games.teamChosen} THEN 1 END)`,
  pending: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} = 'pending' THEN 1 END)`,
})
.from(users)
.leftJoin(games, eq(users.userId, games.userId))
.leftJoin(adminGames, and(eq(games.gameId, adminGames.gameId), eq(adminGames.year, year)))
.groupBy(users.userId, users.displayName)
.orderBy(sql`correct DESC`)
```

Compute `percentage = correct / total` (null if total === 0) in the route handler after casting counts to Number.

### `returnWeekScores(year: number, week: number): Promise<WeekScoresEntry[]>`

Only users who made picks for the given week appear (INNER JOIN). This differs from leaderboard intentionally — week scores show who participated.

```ts
db.select({
  userId: users.userId,
  displayName: users.displayName,
  total: sql<number>`COUNT(*)`,
  correct: sql<number>`COUNT(CASE WHEN ...)`,
  incorrect: sql<number>`COUNT(CASE WHEN ...)`,
  pending: sql<number>`COUNT(CASE WHEN ...)`,
})
.from(games)
.innerJoin(adminGames, and(eq(games.gameId, adminGames.gameId), eq(adminGames.year, year), eq(adminGames.weekNumber, week)))
.innerJoin(users, eq(games.userId, users.userId))
.groupBy(users.userId, users.displayName)
```

Use the same CASE logic as `returnUserPickHistory` (line 151–153 of `dbUserFunctions.ts`).

---

## Step 3: Create `packages/backend/src/routes/leaderboard.ts`

Two endpoints, both require `authMiddleware`. No role restriction.

```
GET /          ?year=          → season standings (LeaderboardEntry[])
GET /scores    ?year=&week=    → week pick results (WeekScoresEntry[])
```

Validation pattern mirrors `user.ts`:
- year: Number(), check `isNaN || < 1900 || > 2100`, throw 400
- week: Number(), check `isNaN || < 1 || > 52`, throw 400

Response shapes:
```json
// GET /api/leaderboard?year=2024
{ "leaderboard": [...] }

// GET /api/leaderboard/scores?year=2024&week=1
{ "scores": [...] }
```

---

## Step 4: Register route in `src/index.ts`

Add `.route('/api/leaderboard', leaderboardRoutes)` to the `routes` chain (lines 34–37). The `AppType` export at line 63 picks this up automatically.

---

## Step 5: Tests in `tests/routes/leaderboard.test.ts`

Follow the exact pattern of `tests/routes/userHistory.test.ts`:
- Hono app wrapping just the leaderboard route
- `makeToken()` helper with `sign()`
- `beforeAll(() => seedTestData())`
- Use `createTestGame()`, `addPickedGame()`, `createTestUser()` from `tests/db-utils.ts`
- Raw SQL to update `winning_team` for completed game simulation

Test cases for `GET /api/leaderboard`:
- Returns empty array when no users have picks
- User with zero picks appears with all zeros
- User with more correct picks ranks higher than user with fewer
- Pending games count toward `total` but not `correct`/`incorrect`
- Returns 401 with no auth token
- Returns 400 for invalid year
- Tied users both appear in results (order not asserted)

Test cases for `GET /api/leaderboard/scores`:
- Returns empty array when no picks for the week
- Returns correct per-user counts for a week
- Returns 401 with no auth token
- Returns 400 for invalid year or week

---

## Verification

```bash
# Type-check
npx tsc --noEmit -p packages/backend/tsconfig.json
npx tsc --noEmit -p packages/frontend/tsconfig.app.json

# Run new tests
pnpm test:backend

# Manual smoke test (requires running backend + DB)
curl -b "auth_token=<token>" "http://localhost:3000/api/leaderboard?year=2024"
curl -b "auth_token=<token>" "http://localhost:3000/api/leaderboard/scores?year=2024&week=1"
```
