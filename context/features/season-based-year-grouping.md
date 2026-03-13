# Plan: Season-Based Year Grouping

## Context

The app currently uses `new Date().getFullYear()` everywhere to determine the "current" year for defaults and dropdowns. This breaks in January–February: the calendar year rolls to (e.g.) 2026, but the CFB season (including bowl games and the national championship) is still the 2025 season. Users see 2026 as the default with no data. The fix is a `getCurrentSeason()` utility that delays the rollover until March 1st.

---

## New Utility: `getCurrentSeason()`

**File:** `packages/frontend/src/utils/weekCalculation.ts` (add to this existing file — no new file needed)

Add a named constant and a new exported function:

```
SEASON_ROLLOVER_MONTH — reads from VITE_SEASON_ROLLOVER_MONTH env var (1-based, e.g. 3 for March), defaults to 3. Convert to 0-based internally for JS Date comparison.
```

```
getCurrentSeason(date = new Date()): number
  - If date.getMonth() < (SEASON_ROLLOVER_MONTH - 1), return date.getFullYear() - 1
  - Otherwise return date.getFullYear()
```

The function accepts an optional `date` param for testability.

---

## Files to Change

### 1. `packages/frontend/src/utils/weekCalculation.ts`
- Add `SEASON_ROLLOVER_MONTH` constant (env var with default 3).
- Add exported `getCurrentSeason(date?)` function.
- Replace the three `now.getFullYear()` fallback calls (lines 19, 39, 47) with `getCurrentSeason(now)`.

### 2. `packages/frontend/src/components/user/UserPicksSection.tsx`
- Import `getCurrentSeason` from `weekCalculation`.
- In the `initialize` effect, replace `new Date().getFullYear()` with `getCurrentSeason()`.
- Change the two `getWeeksForYear` calls to use `getCurrentSeason() - 1` and `getCurrentSeason()`.
- Rename `nextYearResult` → `currentSeasonResult` (the variable currently misnamed — it fetches `currentYear`, not `currentYear + 1`).

### 3. `packages/frontend/src/components/user/WeekResultsSection.tsx`
- Same changes as `UserPicksSection`: import `getCurrentSeason`, replace `getFullYear()`, rename `nextYearResult` → `currentSeasonResult`.

### 4. `packages/frontend/src/components/user/UserWeekSelector.tsx`
- Import `getCurrentSeason`.
- Replace `new Date().getFullYear()` with `getCurrentSeason()`.
- Change `<InputLabel>Year</InputLabel>` → `<InputLabel>Season</InputLabel>` and `label="Year"` → `label="Season"`.
- Change MenuItem display text from raw year to `"{year} Season"` (keep the `value` as the raw number since the API uses it).

### 5. `packages/frontend/src/components/user/LeaderboardSection.tsx`
- Move the `currentYear`/`yearOptions` constants from module level into the component body (currently computed at import time, which means they never update mid-session).
- Replace `new Date().getFullYear()` with `getCurrentSeason()`.
- Change `<InputLabel>Year</InputLabel>` → `<InputLabel>Season</InputLabel>` and `label="Year"` → `label="Season"`.
- Change MenuItem display text to `"{year} Season"`.
- Change `useState(currentYear)` → `useState(() => getCurrentSeason())` (lazy initializer to avoid stale closure).

### 6. `packages/frontend/src/components/admin/AdminSection.tsx`
- Import `getCurrentSeason`.
- Replace `new Date().getFullYear()` on line 22 with `getCurrentSeason()`.
- Update the `"No weeks loaded for {selectedYear}"` display string to `"No weeks loaded for {selectedYear} Season"`.

### 7. `packages/frontend/src/components/admin/WeekSelector.tsx`
- Import `getCurrentSeason`.
- Replace `new Date().getFullYear()` with `getCurrentSeason()`.
- Change `<InputLabel>Year</InputLabel>` → `<InputLabel>Season</InputLabel>` and `label="Year"` → `label="Season"`.
- Change MenuItem display text to `"{year} Season"`.

---

## New Tests

**File:** `packages/frontend/tests/unit/utils/weekCalculation.test.ts` (new file)

Tests for `getCurrentSeason()`:
- January → returns prior year
- February 28 → returns prior year
- March 1 → returns current year
- August → returns current year
- December → returns current year
- Custom `VITE_SEASON_ROLLOVER_MONTH` (e.g. 4 for April) — verify cutoff shifts

---

## Verification

1. Run `pnpm test:frontend` — all existing tests pass, new season utility tests pass.
2. Manually test in browser: set system clock to January 15 (or mock the date in dev) and confirm the default season is the prior year's season.
3. Confirm dropdowns display "2025 Season" etc. in all three selectors (user picks, leaderboard, admin).
4. Confirm the admin "No weeks loaded" message shows "YYYY Season".
5. Run `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` — no type errors.
