# TODO — Issues & Improvements

Roughly priority-ordered within each section.

---

## Bugs

_(none currently open)_

## Validation Gaps

_(none currently open)_

---

## Security

### Weak password minimum (6 characters)
**File:** `packages/backend/src/utils/passwordValidation.ts:15`

Six characters is below modern standards. Recommend 10–12 minimum, or use a strength estimator (e.g. zxcvbn) rather than a length rule alone.

---

## Missing Features / Spec Gaps

_(none currently open)_

---

## Error Handling

_(none currently open)_

---

## Code Quality / Tech Debt

_(none currently open)_

---

## Tests

_(none currently open)_
