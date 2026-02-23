# TODO — Issues & Improvements

Roughly priority-ordered within each section.

---

## Bugs

### `POST /user/picks` partially commits picks before a deadline error
**File:** `packages/backend/src/routes/user.ts:97-116`

The loop interleaves deadline validation with DB writes. If picks `[A, B, C]` are submitted and C is locked, A and B are already upserted before the 422 is thrown. The user sees an error but picks A and B are silently saved. All deadline checks should run in a pre-pass before any writes.

### `setPickedGames` two-statement update is not atomic
**File:** `packages/backend/src/db/dbAdminFunctions.ts:195-214`

`picked = true` and `picked = false` are two separate `UPDATE` statements with no transaction. If the second fails, picked games are partially updated and the "unmark others" step is lost. Needs `db.transaction(...)`.

### Frontend never fetches upcoming season's weeks (pre-season data invisible)
**File:** `packages/frontend/src/components/user/UserPicksSection.tsx`

The initialization fetches `currentSeason - 1` and `currentSeason`. If an admin loads next season's data before the season rollover date (March 1 by default), users won't see those weeks. The misnamed `nextYearResult` variable was fixed in PR #23, but fetching `currentSeason + 1` was not added.

## Validation Gaps

_(none currently open)_

---

## Security

### ~~`GET /admin/users` returns `passwordHash` in the response body~~ ✓ Fixed

`returnUsers()` now selects only `userId`, `email`, `displayName`, `roles` explicitly. The bogus `ProfileData[]` type assertion in the route was removed.

### First-user admin assignment has a TOCTOU race condition
**File:** `packages/backend/src/routes/auth.ts:55-56`

Two concurrent registrations both call `returnUsers()`, both see `length === 0`, and both become admins. The check and insert are not in a transaction. Should be made atomic (e.g. wrap in a transaction, or use a DB-level mechanism).

### Weak password minimum (6 characters)
**File:** `packages/backend/src/utils/passwordValidation.ts:15`

Six characters is below modern standards. Recommend 10–12 minimum, or use a strength estimator (e.g. zxcvbn) rather than a length rule alone.

---

## Missing Features / Spec Gaps

### Email notifications not implemented
**Spec:** `_specs/email-notifications.md`

Nothing from this spec exists in the codebase: no Resend integration, no `notificationPreferences` column, no `PATCH /user/notifications` endpoint, no `POST /admin/week/finalize` endpoint, no cron job.

---

## Error Handling

## Code Quality / Tech Debt

### ~~Zod body schemas don't validate year/week value ranges~~ ✓ Fixed

Added shared `yearSchema` (int, 1900–2100) and `weekSchema` (int, 1–52) constants applied to all four body schemas in `zValidate.ts`. Game IDs also constrained to positive integers.

---

## Tests

### No tests for `returnLeaderboard` — most complex SQL in the codebase
**File:** `packages/backend/src/db/dbUserFunctions.ts:180`

The leaderboard query involves multi-table left joins and conditional aggregation. No test coverage despite being core to the game's scoring. Should cover: correct/incorrect/pending counts, percentage calculation, user with zero picks, tie in rankings.

### ~~No tests for `weekCalculation.ts`~~ ✓ Fixed in PR #23

`getCurrentWeek`, `getMostRecentCompletedWeek`, and the new `getCurrentSeason` utility are now covered in `packages/frontend/tests/unit/utils/weekCalculation.test.ts`.
