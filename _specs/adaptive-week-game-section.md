# Spec for Adaptive Week Game Section

branch: claude/feature/adaptive-week-game-section

## Summary

Merge `UserPicksSection` and `WeekResultsSection` into a single `WeekGameSection` component. The component shares one week selector and one data-fetching layer, then renders either a picks UI (interactive pick inputs + submit) or a results UI (completed game rows with outcome indicators) depending on whether the selected week's games are completed or still upcoming/in-progress.

## Functional Requirements

- A single component replaces both `UserPicksSection` and `WeekResultsSection` in `UserSection`.
- The component initializes by defaulting to the current week (same logic as `UserPicksSection` today).
- After loading games for the selected week, the component determines mode:
  - **Picks mode**: no games in the week have `completed: true`. Render pick inputs and a submit button. Existing saved picks are pre-selected.
  - **Results mode**: at least one game in the week has `completed: true`. Render read-only result rows showing scores and whether the user's pick was correct.
- The week selector (year + week) is shared and controls both modes. Changing the week re-fetches and re-evaluates mode.
- Week initialization fetches prev, current, and next season weeks (same as both existing sections do today).
- When the year changes, weeks list reloads and week resets to the first week of that year.
- Pick submission (in picks mode) behaves identically to the existing `UserPicksSection` submit logic: POST picks, update saved pick state, show snackbar feedback.
- Error and loading states (spinner, empty-state message) are handled the same as today.
- The `UserSection` layout removes the separate "Your Picks" and "This Week's Games" cards and replaces them with a single card (e.g. titled "Games" or "This Week's Games") that spans the full width alongside the Leaderboard card.

## Possible Edge Cases

- A week that is partially complete (some games finished, others not): treat as results mode since `completed` is per-game. Consider showing a mixed view or results-only — pick this explicitly and document in the component.
- A week with no games at all: show the existing empty-state message regardless of mode.
- A future week where no games have been curated yet: same empty-state as above.
- Switching from a completed week (results mode) to an open week (picks mode) must clear results state and restore pick state correctly, and vice versa.
- User navigates to a past week that has no picks recorded: results mode should still render game rows with `teamChosen: null` (no pick shown).
- Rapid week-switching: in-flight requests from a previous week selection should not overwrite state from the latest selection (use a cancel/ignore pattern or track the latest request).

## Acceptance Criteria

- `WeekResultsSection` and `UserPicksSection` are deleted; a new `WeekGameSection` component exists in their place.
- `UserSection` renders one card for `WeekGameSection` instead of two separate cards.
- Selecting the current/future week shows pick inputs with a submit button.
- Selecting a past completed week shows read-only result rows with score and outcome indicators.
- Changing the week selector updates the view correctly in both directions (past → current, current → past).
- Submitted picks persist correctly and pre-populate on re-visit.
- No regressions on the Leaderboard card or admin sections.
- The component handles loading, error, and empty states gracefully.

## Open Questions

- For a partially-completed week (some games done, some not): should the view be results-only for finished games and hide unfinished ones, or show all games in results mode with unfinished games displaying no score yet? This needs a decision before implementation. - after the picking deadline passes, then show the week with their correct or incorrect badge, or pending if game is still going on.
- What should the card title be in `UserSection`? "This Week's Games" works for current weeks but is misleading when viewing past weeks. "Games" or "Weekly Games" may be more neutral. - I like 'Weekly Games'
- Should the default week on initial load remain the current week, or switch to the most recently completed week if the current week has no games yet? - the default should be the current week.

## Testing Guidelines

Create a test file at `packages/frontend/tests/components/user/WeekGameSection.test.tsx`. Keep coverage meaningful but not exhaustive:

- Renders pick inputs when selected week has no completed games.
- Renders result rows when selected week has completed games.
- Switching week selection from a completed week to an open week transitions to picks mode.
- Switching week selection from an open week to a completed week transitions to results mode.
- Submitting picks calls the POST endpoint and shows success snackbar.
- Shows empty-state message when no games exist for selected week.
- Shows error state when the API call fails.

## Personal Opinion

This is a good idea and worth doing. The two existing components are nearly identical in structure — same initialization logic, same week selector, same data fetches — and the only real difference is the render output. The duplication is not trivial; it's ~300 lines of near-identical state and effect logic spread across two files that will diverge over time if left separate.

The main concern is the partially-completed week edge case. The current split-component design sidesteps this because each card always shows its own mode, but the merged component has to make a deliberate call about what to display. That decision should be made before implementation starts (see Open Questions).

The layout change in `UserSection` is minor but needs thought — the current 2-column + full-width grid will change shape. The complexity of the merge itself is low; the data-fetching and mode-switching logic is straightforward.
