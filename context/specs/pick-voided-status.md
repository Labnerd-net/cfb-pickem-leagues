# Spec for Pick Voided Status on Game Deletion

Title: Pick Voided Status on Game Deletion
Branch: claude/fix/pick-voided-status
Spec file: context/specs/pick-voided-status.md

## Summary

`user.games.gameId` has a FK to `admin.games.gameId` with `.onDelete('cascade')`. If an admin deletes a game, every user pick for that game is permanently deleted with no trace. This silently corrupts pick history and makes it impossible to audit what happened.

The fix: add a `'voided'` value to the `teamChosen` column enum, change the FK action to `restrict`, and add a backend route (or extend an existing one) that voids all picks for a game before allowing deletion. This preserves the pick records with an auditable status rather than destroying them.

## Functional Requirements

- Add `'voided'` as a valid value in the `columnTeam` custom enum used by `user.games.teamChosen`.
- Change the `user_games_admin_games_fk` foreign key action from `onDelete('cascade')` to `onDelete('restrict')`.
- When an admin deletes a game that has user picks, the backend must void those picks first (set `teamChosen = 'voided'`), then delete the `admin.games` row. This should be done in a transaction.
- Voided picks must not count toward any leaderboard scores or pick counts.
- Voided picks should be excluded from `GET /user/picks` active responses (since the game no longer exists).
- The pick history endpoint (`GET /user/picks/history`) may optionally include voided picks, but they must be clearly marked and excluded from score tallies.
- No change to the admin UI is required — the existing game delete flow triggers the void-then-delete path automatically in the backend.

## Possible Edge Cases

- A game is deleted that has zero picks — void step is a no-op, delete proceeds normally.
- A game is deleted mid-week after some but not all users have picked — partial picks are voided.
- A game has already been scored/completed before deletion — voided picks that were previously scored must not retroactively affect leaderboard history. The picks remain voided.
- The void-then-delete transaction fails partway through — the transaction must roll back so no picks are voided without the game also being deleted (or vice versa).
- Drizzle migration: changing the FK action requires generating a new migration. The `columnTeam` enum extension also requires a migration. Both must be applied in order.

## Acceptance Criteria

- [ ] `columnTeam` enum includes `'voided'` as a valid value.
- [ ] The FK from `user.games.gameId` to `admin.games.gameId` uses `onDelete('restrict')` in the schema.
- [ ] `DELETE /admin/game/:gameId` (or equivalent) voids all picks for the game in a transaction before deleting the game row.
- [ ] Voided picks are excluded from leaderboard score calculations.
- [ ] Voided picks are excluded from `GET /user/picks` responses.
- [ ] Build passes (`pnpm build`).
- [ ] Drizzle migrations are generated and valid.

## Open Questions

- Should voided picks appear in `GET /user/picks/history`? The backlog suggests keeping an audit trail, but surfacing them to users may be confusing. Default: exclude them unless the endpoint adds an explicit `?includeVoided=true` flag.
- Is there a current admin UI route/handler for deleting individual games, or does game management only support upsert? Need to check `DELETE` route existence in `admin.ts` before implementing.

## Testing Guidelines

- Unit test the new void-picks-then-delete DB function: assert picks are set to `'voided'` and the game row is removed.
- Test the transaction rollback path: simulate a failure after voids but before game delete and assert the database is unchanged.
- Test that voided picks are excluded from the leaderboard query result.
- Test that `GET /user/picks` omits voided picks.

## Personal Opinion

This is a good and necessary change. The silent cascade is a real data integrity risk — admins make mistakes, and losing pick history is worse than a slightly more complex delete flow. The void-then-restrict approach is straightforward and follows the pattern already used for soft-deleting users.

One concern: if there is no existing admin UI or API route for deleting individual games (only upsert), the scope may be smaller than expected — the FK change and enum addition are safe to land without a delete route, since the `restrict` action simply prevents accidental deletion at the DB level until proper tooling is added. Worth confirming before implementation.

Complexity: low-to-medium. Schema changes + one migration + one transactional delete handler + minor query exclusions.
