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

### Frontend never fetches upcoming year's weeks (pre-season data invisible)
**File:** `packages/frontend/src/components/user/UserPicksSection.tsx:37-40`

The initialization fetches `currentYear - 1` and `currentYear`. The variable `nextYearResult` actually fetches `currentYear`, not `currentYear + 1`. If an admin loads next season's data before the calendar year rolls over (common during bowl/pre-season), users won't see those weeks until January 1st.

## Validation Gaps

_(none currently open)_

---

## Security

### `GET /admin/users` returns `passwordHash` in the response body
**File:** `packages/backend/src/routes/admin.ts:18-20`, `packages/backend/src/db/dbUserFunctions.ts:25`

`returnUsers()` does `db.select().from(users)` — all columns. The route assigns this to `ProfileData[]` via TypeScript type assertion, which has no runtime effect. The password hash is included in the JSON response. The DB query should select only the `ProfileData` fields explicitly.

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

### Zod body schemas don't validate year/week value ranges
**File:** `packages/backend/src/utils/zValidate.ts`

`weekIdentifierSchema` accepts any number for `year` and `week` (e.g. `year: -9999`). Range validation exists for URL params but not JSON bodies. Should add `.min()/.max()` constraints to match the URL param guards already in place.

---

## Tests

### No tests for `returnLeaderboard` — most complex SQL in the codebase
**File:** `packages/backend/src/db/dbUserFunctions.ts:180`

The leaderboard query involves multi-table left joins and conditional aggregation. No test coverage despite being core to the game's scoring. Should cover: correct/incorrect/pending counts, percentage calculation, user with zero picks, tie in rankings.

### No tests for `weekCalculation.ts`
**File:** `packages/frontend/src/utils/weekCalculation.ts`

`getCurrentWeek` and `getMostRecentCompletedWeek` contain date-range logic and fallback behavior (off-season, empty array) that drives the default week selection on the entire dashboard. Completely untested.
