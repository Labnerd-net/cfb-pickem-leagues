# Spec for Leaderboard and Scoring

branch: claude/feature/leaderboard-and-scoring

## Summary

A pick'em game requires some way to determine a winner. Currently there are no endpoints for viewing pick results across users, per-user season records, or any standings. This spec covers adding a leaderboard and scoring layer: who picked correctly each week, per-user season totals, and a ranked standings view.

## Functional Requirements

- An endpoint returns week-level pick results for all users (which users got which games right/wrong/pending) for a given week
- An endpoint returns season-level pick totals per user (total picks, correct, incorrect, pending) for a given year
- An endpoint returns a ranked standings list for a given year, ordering users by correct picks descending
- All leaderboard and scoring endpoints require authentication; any logged-in user can view standings
- Display names are used to identify users — user IDs are not exposed in scoring responses
- A user with zero picks for the year still appears in standings only if the spec says so — this is an open question
- Results reflect the current state of `winningTeam` on admin games; no separate score table is maintained

## Possible Edge Cases

- Games still marked `pending` should count toward total but not correct/incorrect
- Users who have not made any picks for a given week should not appear in that week's results (or appear with zeros — to be decided)
- Ties in the standings (same number of correct picks) — define a tiebreaker or accept that tied users are unordered relative to each other
- A week with no completed games returns all picks as pending
- A user who registered mid-season has fewer possible picks than early registrants; standings should be by raw correct count, not percentage (unless otherwise decided)

## Acceptance Criteria

- `GET /api/user/leaderboard?year=` returns a ranked list of all users with their correct/incorrect/pending/total counts for the year, ordered by correct picks descending
- `GET /api/user/scores?year=&week=` returns per-user pick results for a specific week
- Both endpoints return 400 for invalid year/week parameters
- Both endpoints return 401 when no auth token is present
- An empty result (no picks, no users) returns an empty array — no 404
- Correct/incorrect logic matches the existing pattern: `winningTeam !== 'pending' && winningTeam === teamChosen` is correct; `winningTeam !== 'pending' && winningTeam !== teamChosen` is incorrect

## Open Questions

- Should users with zero picks appear in the standings, or only users who have made at least one pick? - they should appear in the standings
- Tiebreaker: should ties be broken by number of picks attempted, by earliest registration, or left unordered? - left unordered
- Should scores be exposed as a percentage (correct / total) in addition to raw counts? - you can show the percentage, but don't order the list by them
- Are these endpoints under `/api/user/` (any authenticated user) or a new top-level route? - maybe a new top-level route
- Should display names be the only identifier, or should a userId also be included in the response for frontend linking purposes? - probably IDs would be good too

## Testing Guidelines

Create a test file for the new endpoints covering:
- Returns empty array when no picks exist
- Returns correct standings order (user with more correct picks ranks higher)
- Pending games count toward total but not correct/incorrect
- Returns 401 with no auth token
- Returns 400 for invalid year or week parameters
- Tied users both appear in results

## Personal Opinion

This is the right feature to build next — it's the core loop of a pick'em game and without it the app has no way to declare a winner. The implementation is straightforward: it is the same aggregation pattern used in `returnUserPickHistory`, just grouped by user instead of by week. The main design decision to nail down before implementing is whether to expose this under the existing `/api/user/` route or a separate `/api/leaderboard/` route. I'd lean toward a separate route since leaderboard data is about all users, not the authenticated user's own data. Complexity is low; the open questions above are worth answering before writing code.
