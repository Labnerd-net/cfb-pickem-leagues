# Spec for Delete Year Data

Title: Delete Year Data
Branch: claude/feature/delete-year-data
Spec file: context/specs/delete-year-data.md

## Summary

Admins have no way to remove a year's weeks and games once loaded. This is needed when a wrong year is imported or a season needs to be reset before picks begin. Add a `DELETE /admin/year/:year` backend endpoint and a "Reset Year" button in the admin panel.

The FK constraint on `user.games.gameId` is `onDelete('restrict')`, so deleting games that have picks will fail at the DB layer. The design must account for this: if any picks exist for the year, the delete is blocked with a clear error message. There is no cascade-delete of picks — the risk of silently wiping user data is too high and there is no recovery path.

## Functional Requirements

- `DELETE /admin/year/:year` backend endpoint:
  - Requires admin role and auth.
  - Validates `year` param (integer, 1900–2100).
  - Checks whether any `user.games` picks exist for any game belonging to that year.
  - If picks exist: returns 409 with a message explaining picks must be removed first.
  - If no picks exist: deletes all `admin.games` rows for the year, then all `admin.weeks` rows for the year, in that order (games first to satisfy FK ordering).
  - Returns 200 `{ status: 'deleted' }` on success.
- Frontend "Reset Year" button in `AdminSection`:
  - Visible only when weeks are loaded for the selected year (i.e., `weeks.length > 0`).
  - Clicking opens a confirmation dialog ("Delete all weeks and games for {year}? This cannot be undone.").
  - On confirm, calls the delete endpoint.
  - On 409: shows the error message from the API response (picks exist).
  - On success: clears weeks/games state and shows a success snackbar.
  - Button is disabled while the request is in-flight.

## Possible Edge Cases

- Year with weeks but no games: delete should still succeed (no games = no picks to block it).
- Year with games but all picks are voided or deleted: delete should succeed since there are no `user.games` rows for those games.
- Year that does not exist in the DB: endpoint returns 200 (no-op; nothing to delete).
- Concurrent request: second request after first succeeds is a no-op.
- `year` param is not a number or out of range: 400 validation error.

## Acceptance Criteria

- `DELETE /admin/year/2024` with no picks returns 200 and removes all weeks/games for 2024.
- `DELETE /admin/year/2024` when picks exist for any game in 2024 returns 409.
- `DELETE /admin/year/9999` (year not in DB) returns 200.
- `DELETE /admin/year/abc` returns 400.
- Admin UI "Reset Year" button is absent when no weeks are loaded.
- Admin UI "Reset Year" button is present when weeks are loaded.
- Confirming the dialog triggers the request; cancelling does not.
- On 409, the UI displays the blocking message without clearing state.
- On success, the week list and game list both clear.

## Open Questions

- Should the button also appear in the empty-weeks state (in case weeks were partially loaded)? Probably not — there is nothing to delete if no weeks are present. Keeping it simple: show only when `weeks.length > 0`.

## Testing Guidelines

Backend (`packages/backend/tests/`):
- Route test: `DELETE /admin/year/:year` returns 200 and cleans up when no picks exist.
- Route test: returns 409 when picks exist for a game in the year.
- Route test: returns 200 (no-op) for a year not in the DB.
- Route test: returns 400 for a non-numeric year param.
- Route test: requires admin role (403 for non-admin, 401 for unauthenticated).

Frontend (`packages/frontend/tests/`):
- No new frontend unit tests needed — the logic is minimal UI state management. Covered adequately by route tests.

## Personal Opinion

This is a straightforward, low-risk feature. The no-cascade-on-picks decision is the right call — user picks are authoritative data and should not be silently destroyed by an admin accident. The 409 block with a clear message is the correct mitigation.

One concern: the delete order matters (games before weeks) to satisfy the FK from `admin.games` → `admin.weeks`. This should be explicit in the implementation, not assumed.

The scope is simple: one new endpoint, one new DB function, one button with a confirmation dialog. No schema changes or migrations needed.
