# Spec for season-based-year-grouping

branch: claude/feature/season-based-year-grouping

## Summary

Replace the concept of a "year" with a "season" throughout the app. A season is identified by its start year (e.g. "2025 Season") and spans from approximately August through early January of the following calendar year. To avoid the current bug where bowl games played in January are invisible because the UI has rolled over to a new year, we define a hard offseason cutoff: March 1st. Before March 1st, the active season is still considered the prior calendar year's season (e.g. January 2026 → 2025 Season). On or after March 1st, the active season rolls forward (e.g. March 2026 → 2026 Season).

The underlying `year` field in the database does not need to change — it continues to store the calendar year the games/weeks were loaded under. The season concept is a display and defaulting layer on top of that. The only data change is how the "current" or "active" season is calculated, and how seasons are labeled in the UI.

## Functional Requirements

- Define a season cutoff date of March 1st (configurable constant, not hardcoded magic numbers throughout the codebase).
- Add a utility function `getCurrentSeason(date)` that returns the active season year:
  - If the current date is before March 1st of the current calendar year, return `currentYear - 1`.
  - Otherwise, return `currentYear`.
- Replace all uses of `new Date().getFullYear()` used to determine the "current" or "default" year with `getCurrentSeason()`.
- Update the year selector dropdown in `UserWeekSelector` to display options as "YYYY Season" (e.g. "2025 Season") instead of bare years.
- Update the leaderboard year selector in `LeaderboardSection` to use the same "YYYY Season" label format and default to `getCurrentSeason()`.
- Update the admin section year selector (if one exists) to use the same label format.
- The initialization logic in `UserPicksSection` and `WeekResultsSection` that fetches weeks for `currentYear - 1` and `currentYear` should be updated to fetch the two seasons adjacent to `getCurrentSeason()` (i.e. `getCurrentSeason() - 1` and `getCurrentSeason()`), ensuring bowl season data is always within the active window.
- The variable currently named `nextYearResult` (which actually fetches the current year) should be renamed to accurately reflect what it holds after this change.
- No database schema changes are required. The `year` column continues to store calendar years.
- No API contract changes are required. The `year` field in requests/responses continues to carry a calendar year integer.

## Possible Edge Cases

- A user visits in late February: the app should still show the prior year's season as active, not the new calendar year.
- A user visits on March 1st exactly: the new season becomes active that day.
- An admin loads next season's data in February (pre-cutover): it should be accessible under the upcoming season year but the default should still be the current season.
- The season options list in dropdowns should always show at least the current season and one prior season; consider showing two prior seasons to allow looking up older history.
- The offseason cutoff is a constant — if it ever needs to change (e.g. a year with an unusually late championship), it should be easy to find and update in one place.
- The `getCurrentSeason()` utility should be deterministic given a date input so it can be unit tested without depending on wall clock time.

## Acceptance Criteria

- In January or February, `getCurrentSeason()` returns the prior calendar year.
- In March through December, `getCurrentSeason()` returns the current calendar year.
- The year selector dropdown shows "2025 Season", "2024 Season", etc. — not bare integers.
- On page load during bowl season (January/February), the default selected season is the prior year's season, and the correct weeks and games are shown without any user interaction.
- The leaderboard defaults to the correct season during bowl season.
- All existing unit tests pass. New tests cover `getCurrentSeason()` for both sides of the March 1st boundary.

## Open Questions

- Should the March 1st cutoff be a backend constant, a frontend constant, or defined once in shared and imported by both? Given that the backend doesn't currently use wall-clock time for season defaulting (it's all driven by client requests), the frontend utility is likely sufficient — but confirm whether any backend logic needs the same concept. - just frontend
- Should the season label ("2025 Season") appear in page titles, the welcome banner, or only in dropdown selectors? - page titles too
- Is there appetite for making the cutoff date configurable via an environment variable, or is a hardcoded constant acceptable? - it can be configurable, but default to March 1st

## Testing Guidelines

Create test file(s) in the appropriate `tests/` folder. Test the following without going overboard:

- `getCurrentSeason()` returns prior year when called with a date in January.
- `getCurrentSeason()` returns prior year when called with a date in February (before March 1st).
- `getCurrentSeason()` returns current year when called on March 1st exactly.
- `getCurrentSeason()` returns current year when called with a date in August (mid-season).
- `getCurrentSeason()` returns current year when called with a date in December (bowl season start).

## Personal Opinion

This is a good idea and the right fix for the visibility bug (also logged in TODO.md). The March 1st cutoff is a reasonable and simple heuristic — the CFB national championship is typically mid-January, so March gives a comfortable buffer.

The scope is well-contained: it's primarily a display/defaulting change with no DB or API contract changes needed. The main risk is that "season year" and "calendar year" are now different concepts in the code, and future contributors could conflate them. Clear naming (`getCurrentSeason` vs `getFullYear`, "season" vs "year" in variable names) will go a long way. The shared constant for the cutoff date is important — if it drifts into multiple places it will become a maintenance problem.

One concern: the leaderboard and the week selectors currently all use independent year state. After this change, they'll each need to call `getCurrentSeason()` for their default. As long as the utility is in a shared location (e.g. `src/utils/seasonCalculation.ts`), this is fine.
