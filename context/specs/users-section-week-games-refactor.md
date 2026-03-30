# Spec for UsersSection and useWeekGames Refactor

Title: UsersSection and useWeekGames Refactor
Branch: claude/feature/users-section-week-games-refactor
Spec file: context/specs/users-section-week-games-refactor.md

## Summary

Two frontend components have grown to handle multiple unrelated responsibilities. This refactor splits each into focused units without any behavior changes.

**#14 — `UsersSection.tsx`** (295 lines): The component handles user list fetching, role toggling, CSV export (including DOM manipulation), and a broadcast notification dialog. Extract the CSV blob/download logic into a `lib/` utility function and move the broadcast dialog into a standalone `BroadcastDialog.tsx` component.

**#15 — `useWeekGames.ts`** (240 lines): The hook mixes initialization, year/week navigation side effects, pick submission, and snackbar state. Split into two hooks — one for week/year navigation and one for pick submission — while preserving all existing behavior including the `cancelled` flag stale-request pattern.

## Functional Requirements

### #14 UsersSection
- Extract CSV generation and blob download into a utility function in `packages/frontend/src/lib/` (e.g., `exportCsv.ts`). The utility accepts rows and a filename, builds the CSV string, creates the blob, triggers the download, and revokes the object URL.
- Extract the broadcast dialog (all state, handlers, and JSX) into `packages/frontend/src/components/admin/BroadcastDialog.tsx`. It receives an `open` boolean and an `onClose` callback as props; it manages its own internal form state.
- `UsersSection.tsx` retains user list fetching, role toggling state, the export button wired to the utility, and `<BroadcastDialog>` rendered with open/close props.

### #15 useWeekGames
- Extract week/year navigation into a `useWeekNavigation` hook. This hook owns: `selectedYear`, `selectedWeek`, `availableYears`, `weeks`, the initialization effect (multi-season fetch + `getCurrentWeek` default), the year-change effect (with `cancelled` flag), and `initializing`/`loading`/`error` state for navigation.
- Extract pick submission into a `usePickSubmit` hook. This hook owns: `userPicks`, `savedPickIds`, `submitting`, `snackbar`, `handlePickChange`, `handleSubmit`, and `handleSnackbarClose`. It receives `selectedYear`, `selectedWeek`, and `games` as parameters (or similar dependency inputs) so it can load picks when the week changes.
- `useWeekGames` becomes a thin composition hook that calls both sub-hooks and merges their return values, preserving the same `UseWeekGamesReturn` interface so `WeekGameSection.tsx` requires no changes.
- The `cancelled` flag stale-request pattern must be preserved in the year-change and games/picks effects.
- `resultsMode` and `resultRows` derived values remain in `useWeekGames` (or move into the navigation hook — whichever keeps the split cleaner).

## Possible Edge Cases

- The broadcast dialog resets its state on close. This reset logic must stay intact in `BroadcastDialog.tsx` and not be lost during extraction.
- `useWeekGames` currently triggers the games+picks fetch when `selectedYear` or `selectedWeek` changes. The split must not break this dependency relationship.
- The year-change effect skips when `initializing` is true — this guard must be preserved in whichever hook owns it.
- `usePickSubmit` needs the games list to load initial user picks on week change. The dependency wiring between the two sub-hooks must be explicit.

## Acceptance Criteria

- [ ] `UsersSection.tsx` is under 150 lines after extraction.
- [ ] `BroadcastDialog.tsx` exists and handles all broadcast dialog state and JSX.
- [ ] CSV export utility exists in `src/lib/` and is used by `UsersSection`.
- [ ] `useWeekGames.ts` is under 60 lines after extraction (composition only).
- [ ] `useWeekNavigation` and `usePickSubmit` hooks exist as separate files.
- [ ] `WeekGameSection.tsx` requires no changes — the `UseWeekGamesReturn` interface is unchanged.
- [ ] All existing behavior is preserved: multi-season init, year navigation, games/picks load, pick submit, snackbar, results mode.
- [ ] `pnpm build` passes with no errors.
- [ ] No existing tests break.

## Open Questions

- None — the split boundaries are clear from the backlog description and existing code.

## Testing Guidelines

These are pure refactors with no behavior change. No new test files are needed. Verify existing tests still pass:
- `pnpm test:frontend` should pass unchanged.
- Smoke-test in the browser: navigate years/weeks, submit picks, open/send/cancel the broadcast dialog, export CSV.

## Personal Opinion

Both extractions are straightforward and worth doing. `UsersSection` mixes DOM manipulation (blob download) into a React component, which is the most obviously wrong smell — extracting that to a `lib/` utility is clean and testable. The broadcast dialog extraction is routine.

The `useWeekGames` split is also sound. The initialization/navigation concerns are clearly separate from pick submission. The only complexity is wiring the dependency between the two sub-hooks (the games-and-picks fetch needs year + week from navigation), but that's a simple parameter pass.

Neither change adds risk. The main thing to watch is preserving the `cancelled` flag pattern exactly — those guards prevent stale async updates and should not be simplified away during the refactor.
