# Spec for Admin Score Correction

Title: Admin Score Correction
Branch: claude/feature/admin-score-correction
Spec file: context/specs/admin-score-correction.md

## Summary

`markGameComplete()` exists in the backend but the `POST /admin/games/complete` route is blocked in production (`NODE_ENV === 'production'` returns 403). When the CFBD API returns wrong final scores, there is no way for an admin to correct them without direct DB access. This feature lifts that restriction and adds a production-safe score correction UI on the admin game cards, backed by a lightweight audit log.

## Functional Requirements

- A new `PATCH /admin/games/:gameId/score` endpoint accepts `homePoints` and `awayPoints`, recalculates `winningTeam`, and updates the game row. It must be available in production (no NODE_ENV guard).
- The endpoint requires admin role. The existing `POST /admin/games/complete` dev-only route is unaffected and stays as-is.
- Each correction is recorded in a new `admin.score_corrections` table: `gameId`, `correctedBy` (userId), `correctedAt`, `oldHomePoints`, `oldAwayPoints`, `newHomePoints`, `newAwayPoints`. This table is append-only — no delete or update.
- The `winningTeam` field must be recalculated from the new scores on every correction (including the tie case, which stays `pending`).
- After a successful correction, fire the `rankings_updated` notification if all picked games for the week are now complete — same logic as the existing `/games/complete` handler.
- Admin GameCard gets a "Correct Score" action (button or icon) visible only on games where `picked === true`. Clicking opens a small dialog with editable home/away score fields (pre-filled with current values if `completed === true`, empty otherwise) and a confirm button.
- On success the corrected game data is reflected in the game list without a full page reload.

## Possible Edge Cases

- Correcting a game that has no existing score (not yet completed): the correction sets `completed: true` and assigns scores normally.
- Correcting a game where the score is already correct — no harm; the audit row is still written.
- Tie score (homePoints === awayPoints): `winningTeam` stays `'pending'`. This is consistent with the existing `markGameComplete` logic.
- Non-integer scores are rejected by Zod validation (scores must be non-negative integers).
- Game not found: 404.
- Concurrent corrections by two admins: last write wins; both are recorded in the audit log.

## Acceptance Criteria

- `PATCH /admin/games/:gameId/score` is reachable in production (no NODE_ENV block).
- After a correction, `admin.games` reflects the new scores and `winningTeam`.
- An audit row exists in `admin.score_corrections` with the before/after values and the correcting admin's userId.
- The rankings_updated notification fires when the correction causes all picked games for that week to be complete.
- Admin GameCard shows a "Correct Score" button only on picked games.
- The dialog pre-fills current scores when the game is already completed.
- Invalid inputs (negative numbers, non-integers) are rejected with a 400 from the backend and a visible error in the dialog.

## Open Questions

- Should the `score_corrections` audit log be surfaced anywhere in the UI, or is it DB-only? (Suggest DB-only for now — it's a ~15-user app and the complexity of a corrections history UI isn't warranted yet.)
- Should the "Correct Score" button also appear on un-picked games (e.g. games not surfaced to users)? Probably not — un-picked games have no user picks to affect, so corrections there are meaningless.

## Testing Guidelines

Backend unit/route tests:
- `PATCH /admin/games/:gameId/score` returns 401 without auth, 403 for non-admin role.
- Returns 404 for an unknown gameId.
- Returns 400 for negative scores or non-integer values.
- On valid request: game row is updated, audit row is inserted, response contains updated game data.
- Tie score sets `winningTeam` to `'pending'`.

DB function tests:
- `correctGameScore()` inserts an audit row and returns the updated game.

## Personal Opinion

This is a straightforward, clearly needed feature for a live app. The CFBD API has data quality issues and without this an admin is blocked from fixing wrong results. The scope is well-contained: one new endpoint, one new table, one new dialog. The audit trail adds minimal cost but pays off if a correction is disputed.

The main judgment call is whether to reuse the existing `markGameComplete` DB function or create a new `correctGameScore` function. Creating a new one is cleaner because it also writes the audit row atomically in a transaction. Recommend doing that.

No concerns about complexity — this is a medium-priority, medium-effort feature and the design is straightforward.
