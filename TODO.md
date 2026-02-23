# TODO — Issues & Improvements

Roughly priority-ordered within each section.

---

## Bugs

### ~~`POST /user/picks` partially commits picks before a deadline error~~ ✓ Fixed

Deadline checks now run in a separate pre-pass over all picks before any DB writes begin. A locked game in the middle of the list no longer silently saves the picks that preceded it.

### ~~`setPickedGames` two-statement update is not atomic~~ ✓ Fixed

Both `UPDATE` statements are now wrapped in `db.transaction()`. If either fails, the whole operation rolls back.

### ~~Frontend never fetches upcoming season's weeks (pre-season data invisible)~~ ✓ Fixed

`UserPicksSection`, `WeekResultsSection`, and `UserWeekSelector` now include `currentSeason + 1` so pre-season data loaded by admins is visible before the rollover date.

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

### ~~No tests for `returnLeaderboard` — most complex SQL in the codebase~~ ✓ Fixed

Six tests added to `dbUserFunctions.test.ts` covering: correct/incorrect/pending counts, percentage calculation, null percentage for zero-pick users, descending sort on correct count, year isolation, and empty-year behavior.

### ~~No tests for `weekCalculation.ts`~~ ✓ Fixed in PR #23

`getCurrentWeek`, `getMostRecentCompletedWeek`, and the new `getCurrentSeason` utility are now covered in `packages/frontend/tests/unit/utils/weekCalculation.test.ts`.
