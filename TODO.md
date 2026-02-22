# TODO — Issues & Improvements

Roughly priority-ordered within each section.

---

## Bugs

### ~~`invertPickedGame` always sets `picked: false`~~ — FIXED
`invertPickedGame` was a dead export (no route or frontend called it). Removed entirely from `dbAdminFunctions.ts`. Use `setPickedGames` to replace the full picked set atomically.

---

### ~~External API failures are silently swallowed~~ — FIXED
All `getNcaa*` functions now rethrow after logging. Errors propagate to the route layer and surface as 500 responses instead of silent empty results.

---

### ~~`year=0` passes validation~~ — FIXED
All year parameters now use `isNaN(year) || year < 1900 || year > 2100` bounds checks in both `user.ts` and `admin.ts`.

---

### ~~Negative/zero week numbers are accepted~~ — FIXED
All week parameters now use `isNaN(week) || week < 1 || week > 52` bounds checks in both `user.ts` and `admin.ts`.

---

## Validation Gaps

### ~~Pick values are not validated against allowed enum~~ — FIXED
`allUserPickedRequestValidator` (Zod) is now applied to `POST /user/picks`. It validates `pick` against `z.enum(['home_team', 'away_team'])` and ensures `game` is a number. Also corrected the route's body type from `AllUserGamePicks` to `AllUserGamePicksRequest` to match what the frontend actually sends.

---

### ~~Duplicate game IDs in a single picks request~~ — FIXED
`POST /user/picks` now rejects with 400 if the same game ID appears more than once in the request.

---

### ~~`setPickedGames` accepts an empty games array~~ — FIXED
`POST /admin/picks` now returns 422 if `games` is empty.

---

## Security

### ~~No rate limiting on user routes~~ — FIXED
All routes in `user.ts` and `admin.ts` now use `apiRateLimit` (100 req / 15 min). Previously `authRateLimit` (5 req / 15 min) was mistakenly applied to user/admin routes, and `POST /admin/picks` had no rate limiting at all.

---

### Weak password minimum (6 characters)
**File:** `packages/backend/src/utils/passwordValidation.ts:15`

Six characters is below modern standards. Recommend 10–12 minimum, or use a strength estimator (e.g. zxcvbn) rather than a length rule alone.

---

## Missing Features / Spec Gaps

### Email notifications not implemented
**Spec:** `_specs/email-notifications.md`

Nothing from this spec exists in the codebase: no Resend integration, no `notificationPreferences` column, no `PATCH /user/notifications` endpoint, no `POST /admin/week/finalize` endpoint, no cron job.

---

### No leaderboard or scoring endpoints
No endpoint exists for:
- Viewing pick results for a week (which users got which games right)
- A per-user score/record across the season
- Any kind of standings/leaderboard

This is a core feature of a pick'em game. Without it, there's no way to determine a winner.

---

### No way for a user to view their pick history across weeks
`GET /user/picks` requires explicit `year`/`week` parameters. There is no summary endpoint showing a user's record or history.

---

## Error Handling

### API adapter errors don't propagate to the route layer
Related to the silent failure bug above, but broader: none of the API adapter functions (`getNcaaScoreboard`, `getNcaaSchedule`, `getCfbdGameData`, etc.) rethrow on failure. The route handlers have no way to distinguish "API returned empty week" from "API call failed."

---

### `returnPickedGames` returning 404 vs empty list
**File:** `packages/backend/src/routes/admin.ts:63–64`

A 404 for "no picked games" is correct when used in the context of "this week hasn't been configured," but it conflates two different states: week doesn't exist vs. week exists but nothing is picked yet. The frontend has to handle both as the same error case.

---

## Code Quality / Tech Debt

### ~~`invertPickedGame` is an awkward API~~ — FIXED
Removed. See bug entry above.

---

### ~~User ID handling inconsistency~~ — FIXED
`addUser` returning clause now uses `userId` consistently. `returnUserById` and `deleteUserById` changed from `string` to `number` parameters, eliminating the redundant `String()`/`Number()` conversions in callers.

---

### Hard deletes with no audit trail
User deletion (`DELETE /auth/deleteUser`) permanently removes the account and all picks with no soft-delete, no tombstone, and no audit log. A mistake or compromised account could lose data irreversibly.

Consider:
- Soft delete with `deletedAt` timestamp
- Or at minimum, log deleted user ID/email to a persistent audit table before deletion

---

### ~~`ncaa-api.ts` URL contains a non-breaking hyphen~~ — FIXED
Replaced U+2011 non-breaking hyphen in `all‑conf` with ASCII hyphen (U+002D).

---

## Tests

### ~~No tests for `invertPickedGame`~~ — N/A
Function removed.

---

### No integration tests for the picks deadline enforcement
The TOCTTOU between deadline check and insert is not covered. A test simulating a game that starts between check and insert would catch this.

---

### API adapter error path is untested
No tests confirm that a failed external API call results in an appropriate error response from the admin import endpoints.
