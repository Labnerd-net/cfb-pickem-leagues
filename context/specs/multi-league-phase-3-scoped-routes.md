# Spec: Multi-League — Phase 3: League-Scoped Game Selection, Picks & Leaderboard

## Goal

Thread `leagueId` through all existing backend routes that currently assume a single global context. League admins select games from the shared CFBD cache into their league pool. Picks and leaderboard become league-scoped. Site admin routes for the global cache are simplified (no more `picked` flag logic).

Depends on: Phase 1 (schema), Phase 2 (league middleware).

---

## Admin Routes — Global Cache (site admin, unchanged scope)

These routes manage `admin.weeks` and `admin.games` (the raw CFBD data). They are unchanged in purpose but simplified because `picked` no longer exists.

### `GET /api/admin/games`
- Remove all `picked` filter logic
- Returns all games for the given week (the full CFBD cache for that week)
- Response no longer includes a `picked` field

### `POST /api/admin/games/import` (CFBD import)
- No change in behavior — imports raw game data into `admin.games`
- Remove any logic that set `picked = false` on import

### `DELETE /api/admin/year/:year`
- No change — deletes weeks and games from global cache

---

## New Admin Routes — League Game Selection (league admin)

Mounted under `/api/admin/leagues/:leagueId/games`. Protected by `authMiddleware` + `requireLeagueMembership('admin')`.

### `GET /api/admin/leagues/:leagueId/games`
Query params: `year`, `weekNumber`, `seasonType`

- Returns all games in the global cache for that week, each annotated with `inLeague: boolean` indicating whether the game is already in the league's pool
- Allows the league admin to see the full week and check/uncheck games

### `POST /api/admin/leagues/:leagueId/games/:gameId`
- Adds game to the league's pool (`league_games` insert)
- Returns 409 if already in pool
- Returns 404 if `gameId` does not exist in global cache

### `DELETE /api/admin/leagues/:leagueId/games/:gameId`
- Removes game from league pool (`league_games` delete)
- Returns 409 if any user in the league has already picked this game (picks integrity)

### `POST /api/admin/leagues/:leagueId/games/complete`
Query params: `year`, `weekNumber`, `seasonType`

- Marks all games in the league's pool for that week as complete (mirrors existing `mark-complete` behavior but scoped to league)
- Triggers notifications to league members (Phase 6 wires this up; Phase 3 only marks completion)
- Validates that scores exist for all games before marking complete (same rule as current single-tenant behavior)

### `PATCH /api/admin/leagues/:leagueId/games/:gameId/score`
- Corrects a score for a game in the league's pool
- Writes audit row to `admin.score_corrections` (existing table, no change)
- Recalculates `winningTeam` on `admin.games` (global — score is a global fact)

---

## Modified User Routes

All user routes that currently return or accept game data must now require `leagueId`.

### `GET /api/user/picks`
- Add required `leagueId` query param
- Return 400 if missing
- Only return picks where `user.games.league_id = leagueId`
- Only return games that are in `league_games` for that league (not the full global cache)
- Validate league membership via `requireLeagueMembership()` middleware

### `POST /api/user/picks`
- Add required `leagueId` to request body
- Validate that each `gameId` is in `league_games` for the given league (not just in `admin.games`)
- Insert picks with `league_id` set

### `GET /api/user/results`
- Add required `leagueId` query param
- Filter results to league-scoped games and picks

---

## Modified Leaderboard Route

### `GET /api/leaderboard`
- Add required `leagueId` query param
- Return 400 if missing
- Filter leaderboard to users who are members of that league and picks scoped to that league
- Validate league membership via `requireLeagueMembership()`

### `GET /api/leaderboard/scores` (week scores)
- Add required `leagueId` query param
- Same scoping as above

---

## DB Function Changes

### `dbAdminFunctions.ts`
- Remove all `picked` references from queries
- Add `getGamesForLeagueWeek(leagueId, year, weekNumber, seasonType)` — joins `league_games` to return only selected games
- Add `addGameToLeague(leagueId, gameId)` — inserts into `league_games`
- Add `removeGameFromLeague(leagueId, gameId)` — deletes from `league_games`
- Add `getGlobalGamesWithLeagueStatus(leagueId, year, weekNumber, seasonType)` — full cache + `inLeague` annotation

### `dbUserFunctions.ts`
- All pick queries gain a `leagueId` parameter
- `addPickedGamesBatch` inserts with `league_id`
- `returnUserGames` filters by `league_id`

### `dbNotificationFunctions.ts`
- `notification_log` unique key gains `league_id` — update insert/check queries

### `dbLeaderboardFunctions.ts` (or existing leaderboard queries)
- All leaderboard queries gain `leagueId` and filter by league membership + scoped picks

---

## Shared Types

- Remove `picked` from `AdminGameData`
- Add `inLeague?: boolean` to `AdminGameData` (present on league-scoped game list endpoint)
- Add `leagueId: number` to `UserPickData` and `UserPickRequest`

---

## Acceptance Criteria

- [ ] Site admin can view the full game cache for a week (no `picked` field in response)
- [ ] League admin can view the week's game cache annotated with `inLeague`
- [ ] League admin can add/remove games from their league pool
- [ ] Removing a picked game returns 409
- [ ] `POST /api/user/picks` with an invalid `leagueId` or game not in the league pool returns 400/403
- [ ] Picks are stored with `league_id`; a pick fetched for League A does not appear in League B
- [ ] Leaderboard results are scoped to the specified league
- [ ] All existing tests pass (update test fixtures to remove `picked`, add `leagueId`)
- [ ] `pnpm build` passes

---

## Out of Scope for This Phase

- Frontend changes (Phases 4–5)
- Notification dispatch (Phase 6)
- Removing the old single-tenant `mark-complete` endpoint (can coexist until Phase 6)
