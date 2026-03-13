# Spec for Remove WeekId Schema Variable

branch: claude/feature/remove-weekid-schema

## Summary
Remove the computed `weekId` column (currently `year * 1000 + adjustment + weekNumber`) from all database schemas and shared types. Replace it with a composite primary key of `(year, weekNumber)` on the `adminWeeks` table. This also requires establishing a consistent `weekNumber` mapping across both data sources (CFBD and NCAA-API), since CFBD splits weeks by seasonType (regular week 1 vs postseason week 1) while NCAA-API numbers weeks sequentially across the entire season.

## Functional Requirements
- Remove the `weekId` column from `adminWeeks`, `adminGames`, and user `games` schemas
- Replace the `adminWeeks` primary key with a composite key on `(year, weekNumber)`
- Replace all foreign key references from `weekId` to `(year, weekNumber)` in `adminGames` and user `games`
- Remove the `returnID()` function from `src/api/index.ts`
- Remove `weekId` from all shared types (`AdminWeekData`, `AdminGameData`, `UserGameData`, etc.)
- Remove `weekId` from all DB function queries — replace `eq(table.weekId, id)` filters with `and(eq(table.year, year), eq(table.weekNumber, weekNumber))`
- Remove `weekId` from the `WeekIdData` type (it currently holds `year`, `week`, `seasonType` — may need renaming or restructuring)
- Update all route handlers and frontend API calls that pass or consume `weekId`
- Update indexes to use `(year, weekNumber)` instead of `weekId`

### Week Numbering Consistency
- Define a single continuous week numbering scheme that both data sources map into
- **NCAA-API** already numbers weeks sequentially (1-21 for 2025 season), covering regular through postseason in one flat list — this is the natural fit
- **CFBD** numbers regular season weeks 1-16, then resets to week 1 for postseason. The converter must continue numbering past the regular season (e.g., CFBD postseason week 1 becomes week 17, etc.) so that `weekNumber` is unique per year
- The `seasonType` column should remain on rows for informational/filtering purposes, but it should no longer be part of any key computation

## Possible Edge Cases
- CFBD postseason week numbering: if CFBD returns multiple postseason weeks in future seasons, each must map to a distinct weekNumber (17, 18, etc.)
- Existing data in the database will need a migration that computes the new composite key values from the old `weekId` and drops the column
- Any stored `weekId` values on the frontend (localStorage, URL params, etc.) will break
- The `WeekIdData` type is used in GET query parameters (`?year=2024&week=1&seasonType=regular`) — the seasonType param may still be needed for CFBD API calls even though it's no longer part of the key
- NCAA-API's "today" object returns a week number (e.g., `"week": 21`) that may or may not align with the sequential index used in the games array — verify this mapping
- The last entry in the NCAA schedule-alt response is a summary/aggregate row ("12/13/2025-01/19/2026" with count 47) — this needs to be filtered out rather than treated as a real week

## Acceptance Criteria
- No `weekId` column exists in any schema definition
- No `returnID()` function exists in the codebase
- `adminWeeks` uses `primaryKey({ columns: [table.year, table.weekNumber] })`
- `adminGames` and user `games` reference weeks via `(year, weekNumber)` instead of `weekId`
- All DB queries filter by `(year, weekNumber)` instead of computed weekId
- Shared types no longer contain `weekId`
- CFBD converter maps postseason weeks to continuous numbering (regular week count + postseason week number)
- NCAA converter uses its existing sequential index as weekNumber
- All existing tests pass or are updated to reflect the new schema
- A Drizzle migration is generated that handles the transition

## Open Questions
- Should `seasonType` remain as a query parameter in the API, or should consumers just pass `year` and `weekNumber`? Keeping it simplifies CFBD adapter calls but adds a param that's no longer structurally meaningful. - I would think we can keep the seasonType only in the backend.  The frontend will send year and week number, and the backend will compute what is necessary for the external APIs.
- The NCAA schedule-alt response has a final summary entry that aggregates all postseason games — is this currently being handled or is it being inserted as a week? If so, the converter may already have a latent bug. - That aggregate postseason entry is not being handled.  It will need to be verified it is redundant and ignored.
- Should `WeekIdData` be renamed to something like `WeekRef` or `WeekQuery` now that there's no ID being computed from it? - Yes, maybe WeekQuery. But it is up to you.

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- CFBD week converter: verify postseason weeks get continuous numbering (e.g., 16 regular weeks means postseason week 1 becomes week 17)
- NCAA week converter: verify sequential indexing produces correct weekNumbers and that the aggregate/summary row is excluded
- DB functions: verify queries filter correctly by `(year, weekNumber)` composite
- Shared types: verify no `weekId` field exists in any exported interface

## Personal Opinion
This is a good change. The computed `weekId` is a non-obvious encoding that couples three fields into one integer, making debugging and querying harder than it needs to be. Composite keys are the natural relational approach here and Drizzle supports them well.

The complexity is moderate — it touches every layer (schema, DB functions, API converters, shared types, routes, frontend) — but each individual change is straightforward. The riskiest part is the CFBD-to-continuous-week-number mapping, since it introduces a new convention that must be documented and consistently applied. The NCAA summary row at the end of the schedule response is also worth investigating — if it's currently being inserted as a week, that's a pre-existing bug this work should fix.
