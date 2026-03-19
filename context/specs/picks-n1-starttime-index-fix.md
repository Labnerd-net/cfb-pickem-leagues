# Spec for Picks N+1 Query and Start Time Index Performance Fix

Title: Picks N+1 Query and Start Time Index Performance Fix
Branch: claude/fix/picks-n1-starttime-index
Spec file: context/specs/picks-n1-starttime-index-fix.md

## Summary

Two unrelated performance issues that are each small in scope and can be fixed together in one pass:

1. **[15] N+1 queries on picks submission**: `POST /user/picks` calls `returnGame(pick.game)` in a sequential `for` loop — one SELECT per pick. `addPickedGame` then calls `returnGame` a second time internally, doubling the query count. For 10 games this means 20 SELECTs before a single INSERT runs.

2. **[19] Missing index on `games.startTime`**: The `admin.games` table has no index on `startTime`. This column is queried during deadline enforcement in `user.ts` and during the cron refresh. At any meaningful number of games, these become full table scans.

## Functional Requirements

### [15] Bulk game fetch on picks submission
- Replace the per-pick `returnGame` call inside the `for` loop in `user.ts` with a single bulk query that fetches all submitted game IDs in one round trip (`WHERE game_id = ANY(...)`).
- Remove the redundant `returnGame` call inside `addPickedGame` in `dbUserFunctions.ts` — the caller should pass validated game data in, not re-fetch it.
- All existing validation behavior (game must exist, game must not be picked yet, deadline enforcement) must be preserved.
- The transaction wrapping picks inserts (added in a prior fix) must be preserved.

### [19] Index on `games.startTime`
- Add a Drizzle index named `games_start_time_idx` on the `startTime` column in `packages/backend/src/db/schema/admin.ts`.
- Generate and run a migration for this change.

## Possible Edge Cases

- Bulk-fetching game IDs with `ANY(...)` where some IDs do not exist in the DB — the validation logic must still correctly reject picks for non-existent games.
- Empty picks submission (zero picks) — the bulk fetch should short-circuit cleanly rather than emit an invalid `ANY({})` query.
- Duplicate game IDs submitted in a single picks payload — the de-duplication or error behavior should remain consistent with the current behavior.

## Acceptance Criteria

- `POST /user/picks` with N games issues exactly one SELECT for game validation (not N or 2N).
- The redundant `returnGame` inside `addPickedGame` (or its replacement function) is removed.
- All existing picks-related behavior is unchanged: invalid games are rejected, picked games are rejected, deadline-expired games are rejected.
- A Drizzle migration exists that adds `games_start_time_idx` to `admin.games`.
- `pnpm build` passes with no errors.
- All existing picks-related tests pass.

## Open Questions

- None — both fixes are well-defined. No API contract changes are needed.

## Testing Guidelines

Create or update tests in `packages/backend/tests/`:
- Unit test for the new bulk-fetch DB function: given an array of game IDs (including some that don't exist), confirm it returns only the matching rows.
- Existing `POST /user/picks` route tests should continue to pass without modification. If they mock `returnGame`, update the mock target to the new bulk-fetch function.
- No new migration-specific tests needed — the index is transparent to application logic.

## Personal Opinion

Both fixes are clear-cut improvements with no downside. [15] is the more impactful one — the 2N query pattern on every picks submission is a real problem even at small scale and the fix is straightforward. [19] is low-risk schema work; the index only helps and the migration is trivial. Combining them makes sense because they're both small, both performance-focused, and neither depends on the other.

No concerns.
