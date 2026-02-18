# Spec for year-selection-dropdown-limited-range

branch: claude/feature/year-selection-dropdown-limited-range

## Summary

Replace the free-form number input (`TextField` of type `number`) used for year selection in both the admin and user week selectors with a Material-UI `Select` dropdown. The dropdown should offer exactly three options: two years ago, last year, and the current year (relative to the current date at render time).

## Functional Requirements

- In `packages/frontend/src/components/admin/WeekSelector.tsx`, replace the year `TextField` with a `Select` dropdown containing `[currentYear - 2, currentYear - 1, currentYear]`.
- In `packages/frontend/src/components/user/UserWeekSelector.tsx`, replace the year `TextField` with a `Select` dropdown containing `[currentYear - 2, currentYear - 1, currentYear]`.
- `currentYear` should be derived from `new Date().getFullYear()` at render time, consistent with existing practice.
- The dropdown should default to the currently `selectedYear` prop value, matching existing controlled-component behavior.
- The change event should call the existing `onYearChange` callback with the selected numeric year value, preserving all downstream behavior (week fetching, state resets, etc.) unchanged.
- The user selector currently allows `currentYear + 1`; this spec narrows that to `currentYear` to avoid showing a year with no data for most of the calendar year.

## Possible Edge Cases

- The `selectedYear` value passed in from parent state may fall outside the three available options (e.g., a year loaded from a saved state or URL param). The dropdown should still render, but the out-of-range value would show as blank/unselected in a standard MUI Select. Consider whether to clamp or leave as-is.
- On New Year's Day (or around midnight), `currentYear` could shift mid-session, causing the rendered options to drift from the initially selected year. This is a known cosmetic edge case and does not require special handling.
- If a selected year has no weeks in the database (e.g., a past year that was never seeded), the week dropdown will be empty. This is already handled downstream by the parent components and does not require changes here.
- Both components are used by different parent components (`AdminSection.tsx` and `UserPicksSection.tsx`). The `UserPicksSection` currently pre-fetches both current and next year on mount; that pre-fetch of next year should be removed or adjusted to pre-fetch `currentYear - 1` instead, since next year is no longer accessible via the selector.

## Acceptance Criteria

- Admin year selector displays as a dropdown with exactly three options: `currentYear - 2`, `currentYear - 1`, `currentYear`.
- User year selector displays as a dropdown with exactly three options: `currentYear - 2`, `currentYear - 1`, `currentYear`.
- Selecting a year from the dropdown triggers the same downstream behavior as the previous text input (week list refreshes, selected week resets appropriately).
- No free-text/number input remains for year selection in either component.
- The dropdowns are visually consistent with the existing week selector dropdowns (MUI `Select` styling).
- TypeScript compiles without errors for both changed files.
- Existing tests continue to pass.

## Open Questions

- Should the year options be labeled as plain numbers (e.g., `2025`) or with a suffix like `2025 Season`? Leaning toward plain numbers for consistency with the current display. - plain numbers, because a season includes the first monthe of the next year
- Should the admin selector's default selected year remain `currentYear`, or should it intelligently select the year with the most recent week data (useful in off-season)? This is out of scope for this spec unless the user decides otherwise. - just remain the currentYear

## Testing Guidelines

Create a test file(s) in the `./tests` folder for the new feature, and create meaningful tests for the following cases, without going too heavy:

- `WeekSelector` renders a Select (not a text input) for the year field.
- `WeekSelector` renders exactly three year options: `currentYear - 2`, `currentYear - 1`, `currentYear`.
- `WeekSelector` calls `onYearChange` with the correct numeric value when a year option is selected.
- `UserWeekSelector` renders a Select for the year field with the same three options.
- `UserWeekSelector` calls `onYearChange` with the correct numeric value when a year option is selected.

## Personal Opinion

This is a good change. The free-form number input is a poor UX choice for a field with such a narrow valid range — users could accidentally type arbitrary years, and the field offers no affordance for what values are acceptable. A three-item dropdown is the right tool here.

The tradeoff is that an admin who wants to pre-seed the upcoming season before January 1st (e.g., in December) would not have access to next year via this dropdown. In practice, CFB offseason data preparation happens in late summer, not December, so this is an acceptable limitation. If that use case ever becomes real, it warrants a separate solution rather than keeping a mostly-empty option in the dropdown year-round.

Overall: simple, low-risk, clear improvement.
