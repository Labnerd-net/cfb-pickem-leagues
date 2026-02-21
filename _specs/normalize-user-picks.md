# Spec for normalize-user-picks

branch: claude/feature/normalize-user-picks

## Summary

The `user.games` table currently duplicates game data from `admin.games` — teams, scores, points, `winningTeam`, `completed`, `weekNumber`, `year`, `seasonType`, and external IDs are all copied at pick submission time. This creates two problems: there is no mechanism to push score updates to existing picks, and any score change in `admin.games` leaves `user.games` silently stale. The fix is to reduce `user.games` to a minimal picks-only table (`userId`, `gameId`, `teamChosen`) and join with `admin.games` at query time.

## Functional Requirements

- The `user.games` table stores only `userId`, `gameId`, and `teamChosen`; all game metadata is sourced from `admin.games` at query time
- Submitting or updating a pick writes only those three fields; the game's current state (scores, teams, completion) is never copied
- The endpoint that returns a user's picks for a week (`GET /user/picks`) joins `user.games` with `admin.games` and returns the combined shape currently expected by the frontend — no frontend changes required
- The endpoint that returns picked games for a week (`GET /user/games`) similarly joins at query time
- Updating a pick (re-submitting a different team choice) still uses `onConflictDoUpdate` on `(userId, gameId)`, updating only `teamChosen`
- The `user.games` primary key remains `(userId, gameId)`
- A Drizzle migration is generated and committed that drops the redundant columns from `user.games`
- The shared type `UserGameData` is updated to reflect that game metadata fields come from the join, not from `user.games` directly — the external shape returned to the frontend is unchanged
- The `-1` sentinel for `homePoints`/`awayPoints` is not addressed in this change (see Architecture Notes item 2); use whatever `admin.games` stores

## Possible Edge Cases

- **Deleted admin game**: If an admin game is removed after a user has made a pick, the join will produce no row for that pick. The query should handle this gracefully — either filter out orphaned picks or surface them as an error. A cascade delete on `gameId` referencing `admin.games` would prevent orphans but requires the FK to be added in the migration.
- **Migration on live data**: Existing rows in `user.games` have the redundant columns populated. The migration must drop those columns. Any picks already stored remain valid since `userId`, `gameId`, and `teamChosen` are preserved.
- **Concurrent pick submission during migration**: Standard concern for any schema migration; no special handling needed beyond running the migration with low traffic or during a maintenance window.

## Acceptance Criteria

- `user.games` table contains only `user_id`, `game_id`, `team_chosen`, and `created_at` after migration
- `GET /user/picks` returns the same response shape as before — game metadata (teams, scores, completion) is present and accurate, sourced live from `admin.games`
- Submitting a pick no longer reads from `admin.games` to copy fields; it only writes `userId`, `gameId`, `teamChosen`
- If scores are updated in `admin.games`, the next call to `GET /user/picks` reflects the updated scores without any additional sync step
- All existing backend tests pass; new tests cover the join query returning correct merged data

## Open Questions

- Should a foreign key from `user.games.gameId` to `admin.games.gameId` be added to enforce referential integrity and get cascade deletes? This would prevent orphaned picks but means a user's pick record disappears if an admin removes a game. The alternative is a soft join that returns null for missing games. - add the foreign key with cascade deletes.
- Does the frontend currently depend on `UserDbGameData` including `createdAt` from `user.games`? If so, the join should also return `user.games.created_at` for the pick creation time. - there is no current use of the createdAt table.

## Testing Guidelines

Create test file(s) in the `./tests` folder for the following cases, without going too heavy:

- Submitting a pick inserts only `userId`, `gameId`, `teamChosen` into `user.games`
- Re-submitting a pick for the same game updates `teamChosen` without error
- `returnUserGames` returns rows with full game metadata (teams, scores, completion) from the join
- If `admin.games` is updated (e.g. scores added), `returnUserGames` returns the updated values without re-submitting the pick
- Picks for a week with no matching admin games return an empty array

## Personal Opinion

This is the right change. The current schema is objectively wrong — duplicating mutable state without a sync mechanism is a bug waiting to be noticed in production (a user's pick page will show wrong scores after results come in). The fix is straightforward: shrink the table to what picks actually are (`userId`, `gameId`, `teamChosen`) and join for the rest.

The scope is manageable but touches multiple layers: schema, migration, DB functions, shared types. The main risk is the migration on live data — dropping columns is irreversible, so the migration should be reviewed carefully before running against production. I'd add the foreign key from `gameId` to `admin.games.gameId` with cascade delete while in here; it costs nothing and prevents a class of silent data integrity issues.

Not too complex, not trivial. Worth doing before the user base grows.
