# TODO — Issues & Improvements

Roughly priority-ordered within each section.

---

## Bugs

_(none currently open)_

## Validation Gaps

_(none currently open)_

---

## Security

### First-user admin assignment has a TOCTOU race condition
**File:** `packages/backend/src/routes/auth.ts:55-56`

Two concurrent registrations both call `returnUsers()`, both see `length === 0`, and both become admins. The check and insert are not in a transaction. Should be made atomic (e.g. wrap in a transaction, or use a DB-level mechanism).

### Weak password minimum (6 characters)
**File:** `packages/backend/src/utils/passwordValidation.ts:15`

Six characters is below modern standards. Recommend 10–12 minimum, or use a strength estimator (e.g. zxcvbn) rather than a length rule alone.

---

## Missing Features / Spec Gaps

_(none currently open)_

---

## Error Handling

## Code Quality / Tech Debt

_(none currently open)_

---

## Tests

_(none currently open)_
