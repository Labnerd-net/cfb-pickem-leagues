# Admin Dashboard Functions

## Overview

Add administrative capabilities to the dashboard for users with admin roles. Admins need the ability to manage weekly game data by populating weeks from external data sources and curating which games should be available for all users to make picks on. This feature enables admins to control the game selection workflow for the entire pick'em competition.

## Goals

- Provide admins with tools to manage weekly game data within the dashboard
- Enable admins to populate weeks with game data from configured external sources
- Allow admins to curate which games from a given week are available for user picks
- Maintain clear separation between admin and regular user dashboard experiences
- Streamline the admin workflow for preparing weekly competitions

## User Stories

1. **As an admin**, I want to see admin-specific controls in my dashboard so that I can manage weekly game data without navigating to separate admin pages.

2. **As an admin**, I want to view all weeks in the current football season so that I can see which weeks have been populated with game data.

3. **As an admin**, I want to populate a specific week with game data from our configured data source so that games become available for curation.

4. **As an admin**, I want to see all games for a selected week so that I can decide which games should be available for user picks.

5. **As an admin**, I want to select specific games from a week to designate as "pick games" so that users only see relevant, curated matchups.

6. **As a regular user**, I want to see only my standard dashboard without admin controls so that the interface remains simple and focused on my picks.

## Requirements

### Functional Requirements

1. **Admin Section Visibility**
   - Dashboard must conditionally render an admin section only when the authenticated user has the admin role
   - Admin section must be clearly distinguished from regular user content
   - Non-admin users must not see any admin controls or indicators

2. **Week Management Interface**
   - Must display a list or selector showing all weeks in the current football season
   - Must indicate which weeks have already been populated with game data
   - Must provide a way to trigger population of a selected week
   - Week population must fetch data from the configured external data source (NCAA, CFBD, or SportsDataverse)

3. **Week Population**
   - Must allow admin to select a specific week (year, week number, season type)
   - Must trigger backend API call to fetch and store games for the selected week
   - Must provide feedback on success or failure of the population operation
   - Must handle cases where a week is already populated (update or skip)

4. **Game Selection Interface**
   - Must display all games for a selected week after population
   - Must show relevant game information (teams, date/time, location)
   - Must allow admin to select/deselect individual games
   - Must provide a way to mark selected games as "pick games" available to all users
   - Must clearly indicate which games are currently designated as pick games

5. **Pick Games Management**
   - Must save the admin's game selections to designate them as pick games
   - Must make designated pick games visible to all users for making predictions
   - Must allow admins to modify pick game selections before users start picking
   - Must provide clear confirmation when pick games are saved

### Non-Functional Requirements

1. **Performance**: Week population should complete within reasonable time, with progress indication for long operations
2. **Accessibility**: All admin controls must be keyboard accessible and screen-reader friendly
3. **Responsiveness**: Admin interface must work well on desktop and tablet (mobile admin workflow is lower priority)
4. **Security**: All admin operations must verify admin role on both frontend and backend
5. **Usability**: Admin workflow should be intuitive with clear labels and helpful feedback messages

## Acceptance Criteria

- [ ] Dashboard displays admin section only when user has admin role
- [ ] Dashboard does not display admin section for regular users
- [ ] Admin can view a list of all weeks in the current football season
- [ ] Admin can identify which weeks are already populated vs. empty
- [ ] Admin can trigger population of a selected week from external data source
- [ ] Week population successfully fetches and stores games in the database
- [ ] Admin receives clear feedback on successful or failed population operations
- [ ] After populating a week, admin can view all games for that week
- [ ] Admin can see game details including teams, date/time, and location
- [ ] Admin can select individual games from the week
- [ ] Admin can save selected games as designated "pick games"
- [ ] Designated pick games are persisted to the database
- [ ] Pick game selections can be modified by admin before users begin picking
- [ ] All admin operations verify admin role on the backend
- [ ] Admin interface provides clear visual feedback for all actions
- [ ] Error states are handled gracefully with informative messages

## Technical Considerations

- Backend must expose admin endpoints for week population and pick game designation
- Admin endpoints must include role verification middleware
- Week population should use existing external API adapters (NCAA, CFBD, SportsDataverse)
- Pick games should be stored in the admin schema (likely in admin_games table)
- Frontend must check user roles from auth context to conditionally render admin UI
- Consider rate limiting or throttling for external API calls during week population
- May need to handle partial failures if external API returns incomplete data
- UI should use existing DashboardCard or similar components for consistency

## Out of Scope

- Editing individual game details manually (only populating from external sources)
- Scheduling automatic week population
- Bulk operations across multiple weeks
- Advanced game filtering or search within a week
- User pick management or validation within this feature
- Score updates or game result management
- Custom game creation outside of external data sources
- Email notifications to users when pick games are published
- Analytics or reporting on game selection patterns

These items may be added in future iterations but are not part of this initial implementation.

## Future Enhancements

Once this foundation is in place, the admin dashboard can be enhanced with:
- Automatic scheduling of week population before each game week
- Bulk selection tools (e.g., "select all ranked matchups")
- Preview of how pick games will appear to users
- Game filtering by conference, ranking, or other criteria
- Publishing workflow with draft/published states for pick games
- Audit log of admin actions for accountability
- Analytics showing which games users find most interesting to pick
