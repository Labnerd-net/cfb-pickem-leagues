# TODO — Issues & Improvements

Roughly priority-ordered within each section.

---

## Bugs

## Validation Gaps

_(none currently open)_

---

## Security

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

_(none currently open)_

---

## Tests

_(none currently open)_
