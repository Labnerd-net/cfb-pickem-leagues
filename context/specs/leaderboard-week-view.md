# Spec for Leaderboard Week View

Title: Leaderboard Week View
Branch: claude/feature/leaderboard-week-view
Spec file: context/specs/leaderboard-week-view.md

## Summary

`LeaderboardSection.tsx` currently only shows season-level standings (`GET /leaderboard`). A separate endpoint `GET /leaderboard/scores` already returns per-week pick results (`WeekScoresEntry[]`: correct, incorrect, pending, total per user) but has no frontend UI.

Add a "Season" / "Week" toggle to `LeaderboardSection`. "Season" keeps the existing view unchanged. "Week" adds a week selector and displays the results from `GET /leaderboard/scores` in a new table that shows correct, incorrect, pending, and total columns (no percentage, since `WeekScoresEntry` doesn't include it — though it can be derived as `correct/total`).

## Functional Requirements

- Add a toggle (e.g. MUI `ToggleButtonGroup` or `Tabs`) with two options: **Season** and **Week**
- **Season view** (default): existing table unchanged — `#`, Name, Correct, Total, `%`
- **Week view**:
  - Year selector (reuse existing pattern from the Season view)
  - Week selector populated by `getWeeksForYear(year)` from `userRequests.ts`; defaults to the most recent week
  - Table columns: `#`, Name, Correct, Incorrect, Pending, Total, `%` (derived as `correct/total`, null when total is 0)
  - Rows sorted descending by correct picks (ties broken by fewest incorrect)
  - Current user's row highlighted (same `action.selected` pattern as Season view)
  - Loading and empty states consistent with Season view
- `getWeekScores(year, weekNumber)` API function added to `leaderboardRequests.ts` calling `GET /leaderboard/scores`
- Week selector disabled while loading

## Possible Edge Cases

- Week list may be empty if no weeks have been imported for the selected year — show the existing "No standings yet" empty state
- A week may have no picks yet (scores endpoint returns empty array) — same empty state
- Switching from Season to Week (or vice versa) should reset loading state cleanly; a stale-request guard (cancelled flag pattern) should be used in the week-data effect to prevent race conditions on rapid year/week changes
- The year selector in Week view should be independent of the year selector in Season view

## Acceptance Criteria

- Season view renders identically to today — no regression
- Week view shows per-week results from `GET /leaderboard/scores` with correct column set
- Switching views does not cause a blank flash or stale data
- Current user's row is highlighted in both views
- Build passes (`pnpm build`)

## Open Questions

None.

## Testing Guidelines

- Add `getWeekScores` to `leaderboardRequests.ts` tests (or mock-based frontend tests if they exist) covering success and error paths
- No new backend tests needed — `GET /leaderboard/scores` already has coverage

## Personal Opinion

Straightforward and useful. The backend is already done — this is purely a frontend wiring task. Option 1 (toggle) is the right call: it keeps season standings as the default landing state (which is what most users want at a glance) while making week results one click away. The main implementation risk is the stale-request pattern on the week effect — worth getting right since year and week selectors can change independently in quick succession.
