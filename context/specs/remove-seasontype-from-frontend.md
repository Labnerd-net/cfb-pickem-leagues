# Spec for Remove SeasonType Variables from Frontend

branch: claude/feature/remove-seasontype-from-frontend

## Summary
Remove the seasonType field from frontend components and API requests. The frontend currently hardcodes `seasonType: 'regular'` when making API calls, which limits flexibility and introduces unnecessary coupling. Instead, the backend should automatically derive the seasonType from the week number when interacting with external APIs like CFBD.

## Functional Requirements
- Remove seasonType from the WeekQuery interface in shared types
- Remove seasonType from all frontend components (AdminSection.tsx hardcodes it in two places)
- Remove seasonType from frontend API request functions (adminRequests.ts)
- Backend should automatically calculate seasonType based on week number when making CFBD API calls
- Create a utility function in the backend (likely in api/cfbd.ts or api/index.ts) that maps week numbers to seasonType values according to college football conventions:
  - Regular season: typically weeks 1-15
  - Postseason: typically weeks 16+ (bowl games, playoffs)
- Update backend route handlers to accept week queries without seasonType
- Update database queries to work without receiving seasonType from the frontend (may need to derive it or query differently)
- Ensure all data types that include seasonType (AdminWeekData, AdminGameData, UserGameData) still populate it correctly from backend sources

## Possible Edge Cases
- Week numbers that fall outside typical regular/postseason ranges (e.g., week 0 for kickoff games)
- Different seasonType conventions across different years or data sources
- Postseason games may have overlapping week numbers with different seasonTypes (bowls vs playoffs)
- Spring games or other special game types that use different seasonType values
- Existing database records that already have seasonType stored - ensure backward compatibility
- API requests currently in flight when the change is deployed

## Acceptance Criteria
- Frontend components no longer reference or hardcode seasonType
- WeekQuery interface simplified to only include year and week
- Backend successfully derives correct seasonType for regular season and postseason games
- Admin section still loads weeks and games correctly without frontend specifying seasonType
- All existing functionality (loading games, setting picks) works without regression
- Database queries continue to return seasonType in response objects for display purposes
- Tests updated to reflect the new API contract

## Open Questions
- What is the exact week number cutoff between regular season and postseason? (Need to verify against CFBD data conventions) - the season type for a particular week can be found by the CFBD data from the external api.  maybe new columns can be added to the admin week tables that says how many weeks are regular season or post season for each year.
- Are there any edge cases for week 0 games or championship week that need special handling? - I don't think those need any special consideration
- Should the seasonType calculation function be configurable or hardcoded? - the season type calculation should only be based on the cfbd data retreived from the external api.  We may need to add something to admin weeks table so we can refer to that data in the function. so not configurable or hardcoded.
- Do we need to support spring games or other non-traditional seasonTypes in the calculator function? - only support regular season and postseason

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Test the seasonType calculation function with various week numbers (week 1, 10, 15, 16, 20)
- Test edge cases like week 0
- Test backend API endpoints accepting simplified week queries (year + week only)
- Verify that database responses still include seasonType in returned data
- Integration test: verify admin section can load games for both regular season and postseason weeks
- Ensure existing week and game data in the database is still accessible

## Personal Opinion
This is a sensible refactoring. The frontend shouldn't need to know about seasonType - it's an implementation detail of how external APIs are structured. By deriving it on the backend, we:

**Pros:**
- Simplify the frontend interface
- Reduce the chance of frontend bugs (currently hardcoded to 'regular' which would break for postseason)
- Centralize the logic in one place where it can be easily maintained
- Better separation of concerns

**Concerns:**
- Need to ensure the week-to-seasonType mapping is accurate and well-tested
- The mapping might change over time or vary by data source, so should be easily adjustable
- If the convention changes (e.g., playoff expansion affecting week numbering), we only need to update one place

The change is medium complexity - not trivial (requires backend changes, type updates, and careful testing) but not overly complex. It's a good cleanup that will pay dividends in maintainability.
