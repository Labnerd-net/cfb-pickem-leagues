# Spec for Admin and User Section Component Refactor

Title: Admin and User Section Component Refactor
Branch: claude/fix/admin-user-section-refactor
Spec file: context/specs/admin-user-section-refactor.md

## Summary

Backlog items [23] and [24]. Two large frontend components — `AdminSection.tsx` (369 lines, 9 state vars, 7 handlers) and `WeekGameSection.tsx` (305 lines, 10 state vars, 3 `useEffect` hooks) — mix data-fetching logic with render logic. Extract custom hooks and, in the case of `WeekGameSection`, separate the picks and results render paths into dedicated sub-components. No behavior changes; pure structural refactor.

## Functional Requirements

### AdminSection.tsx [23]

- Extract a `useWeekManagement` hook that owns:
  - `selectedYear`, `selectedWeek`, `weeks`, `weeksChecked` state
  - The `useEffect` that loads weeks when `selectedYear` changes
  - `handleImportWeeks` (calls `addWeeksToYear`, reloads weeks)
  - Returns state and handlers needed by the component
- Extract a `useGameManagement` hook that owns:
  - `games`, `selectedGameIds`, `importing`, `importFeedback` state
  - The `useEffect` that loads games when `selectedYear`/`selectedWeek` changes
  - `handleLoadGames`, `handleSavePickedGames`, `handleImportGames`
  - `handleGameSelection`, `handleSelectAll`, `handleDeselectAll`
  - Returns state and handlers needed by the component
- The `loading`, `errorMessage`, `successMessage` state may remain in the component or be absorbed by the relevant hook — whichever keeps the interface cleaner; use your judgement
- `AdminSection.tsx` JSX should shrink significantly once hooks are extracted

### WeekGameSection.tsx [24]

- Extract a `useWeekGames` hook that owns:
  - All 10 state variables
  - All 3 `useEffect` hooks (initialize, load weeks on year change, load games+picks on week change)
  - `handlePickChange` and `handleSubmit`
  - Returns the state and handlers the component needs to render
- Split the render path into two focused sub-components:
  - `WeekPicksView` — renders the picks UI (`UserPicksGamesList`, submit logic); receives `games`, `picks`, `savedPicks`, `onPickChange`, `onSubmit`, `loading`
  - `WeekResultsView` — renders the results UI (`WeekResultsGameRow` list); receives `resultRows`
- `WeekGameSection.tsx` becomes a thin coordinator: calls the hook, selects picks vs. results mode, renders the appropriate sub-component plus the week selector, loading/error states, and snackbar

## Possible Edge Cases

- The `cancelled` flag pattern in `WeekGameSection`'s `loadGamesAndPicks` effect prevents stale state on rapid week switching — preserve this exactly in the hook
- `AdminSection` loads games reactively via `useEffect` AND imperatively via `handleLoadGames` (called after save). The hook must support both paths without duplicating the fetch logic (i.e., expose a `loadGames` function that the effect also calls)
- Hook files should live alongside their component in the same folder (e.g., `src/components/admin/useWeekManagement.ts`)

## Acceptance Criteria

- All existing AdminSection behavior unchanged: week loading on year change, game loading on year/week change, import weeks, import games, re-import, save picked games, select/deselect all, success/error snackbars
- All existing WeekGameSection behavior unchanged: multi-season init, week navigation, game + picks loading on week change, pick submission, results mode display, stale-request cancellation
- `AdminSection.tsx` JSX renders cleanly using the two new hooks with no inline async logic
- `WeekGameSection.tsx` JSX delegates to `WeekPicksView` or `WeekResultsView` based on `resultsMode`
- No new public API changes (no new routes, no shared type changes)
- `pnpm build` passes with no type errors

## Open Questions

- None; scope is clearly bounded to the two components.

## Testing Guidelines

These are pure refactors with no logic changes, so test focus is narrow:

- No new tests required if existing tests pass after refactor
- Confirm existing frontend tests still pass: `pnpm test:frontend`
- If any hook has conditional logic worth unit-testing in isolation (e.g., week sorting, `resultsMode` detection), add a lightweight test in `packages/frontend/tests/`

## Personal Opinion

Both are good refactors. `AdminSection` is the messier of the two — the `handleLoadGames` / `useEffect` duplication is real and the hook split will eliminate it. `WeekGameSection` is less urgent since the `useEffect` logic is already clean, but splitting picks/results into sub-components will improve readability noticeably.

Neither is complex. The only real risk is the `cancelled` flag in `WeekGameSection` — it must move into the hook intact or stale-state bugs will appear on fast navigation. Otherwise straightforward.
