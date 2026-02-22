# TODO — Issues & Improvements

Roughly priority-ordered within each section.

---

## Bugs

### ~~`invertPickedGame` always sets `picked: false`~~ — FIXED
`invertPickedGame` was a dead export (no route or frontend called it). Removed entirely from `dbAdminFunctions.ts`. Use `setPickedGames` to replace the full picked set atomically.

---

### External API failures are silently swallowed
**Files:** `packages/backend/src/api/ncaa-api.ts:24–26`, `packages/backend/src/api/index.ts:101`

All `getNcaa*` functions catch errors, log them, and return `undefined`. The callers use optional chaining (`ncaaGameData?.games?.forEach(...)`) so they silently process zero games and return a 200 with an empty result. Admin has no indication anything went wrong.

Fix: rethrow after logging, or return a typed `Result<T, Error>` and handle explicitly in the route.

---

### ~~`year=0` passes validation~~ — FIXED
All year parameters now use `isNaN(year) || year < 1900 || year > 2100` bounds checks in both `user.ts` and `admin.ts`.

---

### ~~Negative/zero week numbers are accepted~~ — FIXED
All week parameters now use `isNaN(week) || week < 1 || week > 52` bounds checks in both `user.ts` and `admin.ts`.

---

## Validation Gaps

### Pick values are not validated against allowed enum
**File:** `packages/backend/src/routes/user.ts:70`

`pick.pick` is passed straight to the database without checking it is `"home_team"` or `"away_team"`. The Zod schema for `AllUserGamePicksRequest` in shared types should be enforcing this — verify the zValidate middleware is actually applied to this route and the schema covers the `pick` field.

---

### Duplicate game IDs in a single picks request
**File:** `packages/backend/src/routes/user.ts:70`

If the same `gameId` appears twice in one request, both iterations run and the second silently overwrites the first via `onConflictDoUpdate`. The request should be rejected with a 400.

---

### `setPickedGames` accepts an empty games array
**File:** `packages/backend/src/routes/admin.ts:67–70`

No guard against an empty array, which would clear all picked games for the week with no confirmation. Return a 422 if `pickedGames.games.length === 0`, or add an explicit "clear all" endpoint that requires deliberate action.

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

### `ncaa-api.ts` URL contains a non-breaking hyphen
**File:** `packages/backend/src/api/ncaa-api.ts:19`

```ts
const path = `${classification}/${query.year}/${weekTwoDigits}/all‑conf`;
```

The hyphen in `all‑conf` appears to be a Unicode non-breaking hyphen (U+2011), not an ASCII hyphen. This will cause 404s from the NCAA API. Verify this character is correct.

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
