# Plan: Multi-League Phase 3 — League-Scoped Game Selection, Picks & Leaderboard

## Context

Phase 1 added the `leagues`, `league_members`, and `league_games` tables. Phase 2 wired up league CRUD. Phase 3 replaces the global `picked` flag model with per-league game curation: league admins choose which games go into their pool, picks are stored per-league, and leaderboards are scoped to a league. No frontend changes — backend only. The frontend will be broken until Phase 4/5 (expected).

---

## 1. Schema Changes

### `packages/backend/src/db/schema/admin.ts`
- Remove `picked` boolean column and its two indexes (`games_picked_idx`, `games_year_week_picked_idx`)

### `packages/backend/src/db/schema/users.ts` — `games` table
- Add `leagueId: integer('league_id').notNull().references(() => leagues.leagueId, { onDelete: 'restrict' })`
- Change primary key from `[userId, gameId]` to `[userId, gameId, leagueId]`
- Import `leagues` from `./leagues.js`

### Migration (run `pnpm generate` then `pnpm migrate`)
The generated migration must also include a data migration step (add manually after generating):
```sql
-- Populate league_id for existing picks using the Default League (league_id = 1)
UPDATE "user"."games" SET "league_id" = (
  SELECT "league_id" FROM "leagues" WHERE "name" = 'Default League' LIMIT 1
);
```
Add the column as nullable → run the UPDATE → then make it NOT NULL in the migration.

---

## 2. Shared Types (`packages/shared/types/cfb-pickem-api.ts`)

- `AdminGameData`: remove `picked: boolean`, add `inLeague?: boolean`
- `AdminDbGameData`: same — remove `picked`, it extends `AdminGameData`
- `AllUserGamePicksRequest`: add `leagueId: number`
- Add `leagueId: number` to `UserPickData` (the per-pick response type)

---

## 3. DB Functions — `dbAdminFunctions.ts`

**Remove:**
- `setPickedGames()` — replaced by per-league game selection
- `returnPickedGames()` — callers in `admin.ts` will be updated (see §6)

**Modify:**
- `upsertGameForWeek()`: remove `picked: false` from the initial insert values (line ~113)
- `returnGamesForWeek()`: no logic change; `picked` column gone so response no longer includes it
- `returnGamesBulk()`: no change needed; `picked` removed from schema so callers lose access naturally

**Add (new functions):**
```ts
getGlobalGamesWithLeagueStatus(leagueId, year, week, seasonType)
  // SELECT admin.games.*, (league_games.game_id IS NOT NULL) AS in_league
  // LEFT JOIN league_games ON game_id AND league_id
  // Returns AdminDbGameData with inLeague annotated

addGameToLeague(leagueId, gameId)
  // INSERT INTO league_games — 409 on conflict, 404 if gameId not in admin.games

removeGameFromLeague(leagueId, gameId)
  // Check user.games for any picks on this game in this league → 409 if any exist
  // DELETE FROM league_games

getGamesForLeagueWeek(leagueId, year, week)
  // JOIN admin.games → league_games WHERE league_id = ? AND year/week match
  // Returns AdminDbGameData[]
```

Import `leagueGames` from `./schema/leagues.js` and `games` (user) from `./schema/users.js` (for the picks check in `removeGameFromLeague`).

---

## 4. DB Functions — `dbUserFunctions.ts`

Add `leagueId: number` parameter to all of these:

| Function | Change |
|---|---|
| `addPickedGamesBatch(picks, userId, leagueId)` | Include `leagueId` in insert values; update `onConflictDoUpdate` target to `[userId, gameId, leagueId]` |
| `returnUserGames(identifier, userId, leagueId)` | Add `AND user.games.league_id = leagueId` filter |
| `returnUserPickHistory(year, userId, leagueId)` | Add `AND user.games.league_id = leagueId` filter |
| `returnUserPickCount(userId, year, week, leagueId)` | Add `AND user.games.league_id = leagueId` filter |
| `returnLeaderboard(year, leagueId)` | Filter users to league members; filter picks by `league_id`. Add inner join to `leagueMembers` and filter `user.games.league_id = leagueId` |
| `returnWeekScores(year, week, leagueId)` | Same — filter picks by `league_id` and users by league membership |

---

## 5. New Admin League Route File — `src/routes/adminLeagues.ts`

Mounted at `/api/admin/leagues`. Middleware: `authMiddleware + requireLeagueMembership('admin')` on all `/:leagueId` routes.

| Method | Path | Handler |
|---|---|---|
| `GET` | `/:leagueId/games` | `getGlobalGamesWithLeagueStatus(leagueId, year, week)` — requires `weekIdentifierQueryValidator` |
| `POST` | `/:leagueId/games/:gameId` | `addGameToLeague(leagueId, gameId)` |
| `DELETE` | `/:leagueId/games/:gameId` | `removeGameFromLeague(leagueId, gameId)` — 409 if picks exist |
| `POST` | `/:leagueId/games/complete` | Bulk: fetch all games in league pool for week, call `markGameComplete` on each that has scores. Phase 6 wires up notification. |
| `PATCH` | `/:leagueId/games/:gameId/score` | `correctGameScore(gameId, ...)` (global fact); skip `rankings_updated` dispatch — Phase 6 |

Validators to add to `zValidate.ts`:
- `leagueGameParamValidator`: `{ leagueId: coerce.number, gameId: coerce.number }`

Mount in `src/index.ts`: `.route('/api/admin/leagues', adminLeaguesRoute)`

---

## 6. Existing Admin Route — `src/routes/admin.ts`

**Remove:**
- `POST /picks` endpoint and its `setPickedGames` call + `games_ready` dispatch (the league-admin flow replaces this; `games_ready` moves to Phase 6)

**Modify:**
- `GET /games`: no code change needed — `picked` disappears from schema, so response naturally stops including it
- `POST /games/complete`: remove `returnPickedGames` call and `rankings_updated` dispatch block. Just mark the game and return. Phase 6 re-introduces notifications per-league.
- `PATCH /games/:gameId/score`: same — remove `returnPickedGames` + dispatch block

---

## 7. User Routes — `src/routes/user.ts`

**`GET /games`** (returns available games for a week):
- Add `leagueId` query param (via updated validator or new `leagueIdQueryValidator`)
- Add `requireLeagueMembership()` middleware
- Replace `returnPickedGames(weekIdentifier)` call with `getGamesForLeagueWeek(leagueId, year, week)`

**`GET /picks`**:
- Add `leagueId` query param
- Pass to `returnUserGames(..., leagueId)`

**`POST /picks`**:
- Add `leagueId` to body schema (`allUserPickedRequestSchema`)
- Replace `if (!game.picked)` check with: verify `gameId` is in `league_games` for this `leagueId` (use `getGamesForLeagueWeek` result, or a single `isGameInLeague(leagueId, gameId)` helper)
- Pass `leagueId` to `addPickedGamesBatch`
- Add `requireLeagueMembership()` middleware

**`GET /history`**:
- Add `leagueId` query param
- Pass to `returnUserPickHistory(..., leagueId)`

---

## 8. Leaderboard Routes — `src/routes/leaderboard.ts`

Both endpoints:
- Add `leagueId` to query params (extend `weekIdentifierQueryValidator` or add separate validator)
- Add `requireLeagueMembership()` middleware
- Pass `leagueId` to `returnLeaderboard` / `returnWeekScores`

---

## 9. Test Infrastructure Updates

### `tests/setup.ts` (PGlite schema)
- Remove `picked BOOLEAN NOT NULL` from `CREATE TABLE admin.games`
- Remove the two picked indexes
- Add `league_id INTEGER NOT NULL` to `CREATE TABLE "user".games`
- Update PK: `PRIMARY KEY (user_id, game_id, league_id)`
- Add FK: `REFERENCES leagues (league_id)`

### `tests/db-utils.ts`
- Remove `picked` param from `createTestGame()` (currently defaults to false)
- Add `createLeagueGame(leagueId, gameId)` helper — inserts into `league_games`
- `seedTestData()`: create a Default League (league_id=1) and add both test users as members; this provides a baseline leagueId=1 for tests that don't care about multi-league specifics

### Tests requiring updates (update, do not delete)
- `adminGames.test.ts` — remove `picked` field from expected response shapes, update POST /picks references
- `userPicks.test.ts` — add leagueId to all pick requests/queries; replace `createTestGame(picked=true)` with `createTestGame()` + `createLeagueGame(leagueId, gameId)`
- `leaderboard.test.ts` — add leagueId to all requests; seed league context
- `adminScoreCorrection.test.ts` — remove expectations on `returnPickedGames`-driven behavior
- Any other test that passes `picked` to `createTestGame` or references `game.picked`

Write new test file: `tests/routes/adminLeagues.test.ts` — covers all 5 new endpoints

---

## 10. Verification

1. `pnpm generate` — verify migration SQL looks correct (picks up schema diff)
2. `pnpm migrate` — apply to dev DB
3. `pnpm build` — no TypeScript errors
4. `pnpm test` — all tests pass (updated + new)
