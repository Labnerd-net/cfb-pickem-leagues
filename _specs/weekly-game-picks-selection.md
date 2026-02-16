# Spec for Weekly Game Picks Selection

branch: claude/feature/weekly-game-picks-selection

## Summary
Enable users to view admin-curated games for a specific week and make their picks directly from the dashboard. Users can select a year and week to display available games, with the system defaulting to the current week. Once games are displayed, users can choose which team they think will win for each matchup.

## Functional Requirements
- Display a year and week selector on the user dashboard
- Default the selector to the current week based on the current date
- Fetch and display all admin-picked games for the selected week
- Show each game with both team options clearly visible
- Allow users to select their predicted winner for each game
- Persist user picks to the database
- Display visual feedback when picks are saved successfully
- Show which games the user has already made picks for
- Allow users to change their picks before game deadlines
- Display game times/dates to help users make informed decisions

## Possible Edge Cases
- Selected week has no admin-curated games available
- User attempts to make picks for a week that has already started or completed
- User navigates away before saving picks
- Network failure during pick submission
- Multiple rapid pick changes for the same game
- Year/week combination that doesn't exist in the system
- User tries to access picks for future weeks that haven't been curated yet
- Concurrent pick updates from the same user in different browser tabs

## Acceptance Criteria
- User can select any valid year and week from dropdown/selector controls
- Dashboard automatically loads games for the current week on initial load
- All admin-curated games for the selected week are displayed
- User can make a pick for each available game
- Picks are saved to the database and associated with the user and specific game
- User receives confirmation when picks are successfully saved
- Previously saved picks are displayed when returning to a week
- User cannot submit picks for games that have already started
- Error messages are displayed when no games are available for a selected week
- Loading states are shown while fetching games or saving picks

## Open Questions
- Should users be able to see other users' picks for the same week? - No, I don't want users to collaborate on picks.
- What happens to picks if an admin removes a game after users have already picked it? - That game will need to be removed from the users list of games to decide on
- Should there be a deadline cutoff (e.g., 5 minutes before game time) for making/changing picks? - Not right now.  I will create a spec for this later.
- Do we need a "submit all picks" action or save picks individually as they're made? - I think one button to submit all current picks made.  If not all games were picked, the user can finish picking later.
- Should we show user's pick history/statistics on this dashboard? - Not right now, but that is a good idea for later.
- How do we handle the current week during the off-season? - In the offseason, just default to the first week of the next season

## Testing Guidelines
Create test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Fetching games for a valid week with admin-curated games
- Fetching games for a valid week with no available games
- Submitting a new pick for a game
- Updating an existing pick before game start time
- Attempting to pick a game that has already started (should fail)
- Default week selection matches current week
- Pick persistence across page refreshes
- Error handling for invalid year/week combinations

## Personal Opinion
This is a solid foundational feature that addresses the core user experience. The complexity is moderate—it involves frontend UI for selectors and game display, backend endpoints for fetching games and saving picks, and business logic for determining the current week and validating pick timing.

**Concerns:**
- The "current week" logic needs careful thought—college football has irregular schedules, off-weeks, and postseason. We need to ensure the default week calculation aligns with actual game availability.
- Pick deadline enforcement is critical for game integrity but adds complexity. We need to decide whether this is enforced client-side, server-side, or both.
- The interaction pattern (save on each pick vs. batch submit) significantly impacts UX and error handling complexity.
- Consider whether this feature should include a confirmation step or pick review screen before final submission.

**Overall assessment:** Good idea with clear value. Not too complex, but requires attention to edge cases around timing and data availability. The feature naturally extends existing admin game curation functionality and creates the primary user engagement loop.
