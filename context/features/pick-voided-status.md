# Plan: Pick Voided Status on Game Deletion

## Context

`user.games.gameId` has a FK to `admin.games.gameId` with `.onDelete('cascade')`. If an admin game is ever deleted (e.g., directly in the DB — no delete route exists in the app), every user pick for that game is permanently destroyed with no trace. This is a data integrity risk with no current safeguard.

**Key discovery**: There is no `DELETE /admin/game/:gameId` route in `admin.ts`. The cascade is only reachable via direct DB access. This narrows scope — we don't need a void-then-delete transaction path. Instead:
- Change FK to `restrict` (hard blocks cascade at the DB level)
- Add `'voided'` to the `Team` type as groundwork for future pick-voiding mechanics
- Filter voided picks from all scoring/count queries defensively

## Files to Modify

### 1. `packages/shared/types/cfb-pickem-api.ts` — line 4
Add `"voided"` to the `Team` union:
```ts
export type Team = "home_team" | "away_team" | "pending" | "voided";
```

### 2. `packages/backend/src/db/schema/users.ts` — lines 52–56
Change FK action from `cascade` to `restrict`:
```ts
foreignKey({
  columns: [table.gameId],
  foreignColumns: [adminGames.gameId],
  name: 'user_games_admin_games_fk',
}).onDelete('restrict'),   // was 'cascade'
```

### 3. `packages/backend/src/db/dbUserFunctions.ts` — 5 functions

Import `ne` from drizzle-orm (add to existing import line).

**`returnUserPickHistory` (line 219)**
Add `ne(games.teamChosen, 'voided')` to the WHERE clause. Update the CASE WHEN for `incorrect` to add `AND teamChosen != 'voided'`:
- WHERE: `and(eq(adminGames.year, year), eq(games.userId, userIdNumber), ne(games.teamChosen, 'voided'))`
- The `correct` and `pending` CASE WHENs don't need changes (voided never matches a winning team or 'pending' winningTeam path)
- The `incorrect` CASE WHEN needs `AND teamChosen != 'voided'` added: `COUNT(CASE WHEN winningTeam != 'pending' AND winningTeam != teamChosen AND teamChosen != 'voided' THEN 1 END)`

**`returnLeaderboard` (line 257)**
In the LEFT JOIN CASE WHEN expressions, add `AND teamChosen != 'voided'` to the `correct` and `incorrect` CASE WHENs. (total is the SUM of finished games which derives from correct + incorrect — adjust accordingly.)

**`returnWeekScores` (line 301)**
Add `ne(games.teamChosen, 'voided')` to the WHERE clause (alongside the existing year/week/userId conditions). Also add `AND teamChosen != 'voided'` to the `incorrect` CASE WHEN.

**`returnUserPickCount` (line 341)**
Add `ne(games.teamChosen, 'voided')` to the WHERE clause.

**`returnUserGames` (line 370)**
Add `ne(games.teamChosen, 'voided')` to the WHERE clause so voided picks are not returned to the frontend.

### 4. Migration — `packages/backend`
Run `pnpm generate` to produce a Drizzle migration for the FK constraint change.

## Out of Scope
- No delete game route is being added (not in spec).
- No admin UI changes.
- No `voidPicksForGame` DB function (no route to call it from; can be added later when a delete route is built).

## Tests

Add to `packages/backend/tests/`:
- Confirm voided picks are excluded from `returnUserPickHistory` total/correct/incorrect counts.
- Confirm voided picks are excluded from `returnLeaderboard` correct/incorrect scores.
- Confirm voided picks are excluded from `returnWeekScores`.
- Confirm `returnUserPickCount` does not count voided picks.
- Confirm `returnUserGames` does not return voided picks.

## Verification
1. `pnpm generate` in `packages/backend` — migration file created with FK constraint change.
2. `pnpm migrate` (test DB) — migration applies cleanly.
3. `pnpm build` — no type errors.
4. `pnpm test:backend` — all tests pass including new ones.
