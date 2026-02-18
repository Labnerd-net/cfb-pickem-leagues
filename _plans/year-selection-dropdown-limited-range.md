# Plan: Year Selection Dropdown with Limited Range

## Context

Both the admin (`WeekSelector`) and user (`UserWeekSelector`) year selectors currently use a free-form `TextField` with `type="number"` and wide min/max bounds (up to 5 years back, and next year for users). This gives users no affordance for valid values and allows arbitrary input. The goal is to replace both with a MUI `Select` dropdown offering exactly three options: `[currentYear - 2, currentYear - 1, currentYear]`. Year labels are plain numbers (no suffix). Admin default remains `currentYear`.

---

## Files to Modify

### 1. `packages/frontend/src/components/admin/WeekSelector.tsx`

- Remove `currentYear` from the `WeekSelectorProps` interface — it was only used for TextField min/max bounds, which no longer exist.
- Compute `currentYear` internally: `const currentYear = new Date().getFullYear();`
- Replace the `TextField` year input with a `FormControl` + `InputLabel` + `Select` + three `MenuItem` elements, matching the existing week dropdown pattern already used in this file.
- Options: `currentYear - 2`, `currentYear - 1`, `currentYear` (plain number labels).
- Keep `disabled={loading}` on the `Select`.
- The `onChange` handler should call `onYearChange(Number(e.target.value))`.

### 2. `packages/frontend/src/components/admin/AdminSection.tsx`

- Remove the `currentYear` prop from the `<WeekSelector>` JSX call, since it is no longer part of `WeekSelectorProps`.
- No other changes needed — `currentYear` is still used in `AdminSection` for its own state initialization.

### 3. `packages/frontend/src/components/user/UserWeekSelector.tsx`

- `currentYear` is already computed locally via `new Date().getFullYear()` — keep that.
- Replace the `TextField` year input with the same `FormControl` + `InputLabel` + `Select` + three `MenuItem` pattern as above.
- Options: `currentYear - 2`, `currentYear - 1`, `currentYear`.
- Keep `disabled={loading}`.
- The `onChange` handler should call `onYearChange(Number(e.target.value))`.

### 4. `packages/frontend/src/components/user/UserPicksSection.tsx`

- The initial mount `useEffect` currently fetches weeks for **both `currentYear` and `currentYear + 1`** in parallel (to handle off-season smart week detection). Since `currentYear + 1` is no longer accessible via the selector, change this to fetch **`currentYear - 1` and `currentYear`** instead.
- The `Promise.all` call and the `getCurrentWeek(allWeeks)` logic downstream remain unchanged — only the two year values passed to `getWeeksForYear` change.
- No other changes to `UserPicksSection` are needed.

---

## Files to Create

### 5. `packages/frontend/tests/WeekSelector.test.tsx` (new)

Tests:
- Renders a `Select` (not a text input) for the year field.
- Renders exactly three year options: `currentYear - 2`, `currentYear - 1`, `currentYear`.
- Calls `onYearChange` with the correct numeric year value when an option is selected.

### 6. `packages/frontend/tests/UserWeekSelector.test.tsx` (new)

Tests:
- Renders a `Select` (not a text input) for the year field.
- Renders exactly three year options: `currentYear - 2`, `currentYear - 1`, `currentYear`.
- Calls `onYearChange` with the correct numeric year value when an option is selected.

Look at existing frontend test files (e.g., `authRequests.test.ts`) for the testing setup patterns (Vitest, imports, etc.).

---

## Key Patterns to Reuse

- The **week `Select` dropdown** in both `WeekSelector.tsx` and `UserWeekSelector.tsx` already uses `FormControl` + `InputLabel` + `Select` + `MenuItem`. Mirror that structure exactly for the year dropdown.
- MUI `Select` `value` should be `selectedYear` (number), `onChange` receives `SelectChangeEvent<number>`.

---

## Verification

1. Run `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` — should compile with no errors.
2. Run `pnpm test:frontend` — all existing tests pass and new tests pass.
3. Start the dev server (`pnpm dev:frontend`) and manually verify:
   - Admin week selector shows a dropdown with 3 year options (no text input).
   - User picks section shows a dropdown with 3 year options.
   - Selecting a different year correctly refreshes the week list.
   - Default year is the current year in both views.
