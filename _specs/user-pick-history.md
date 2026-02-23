# Spec for User Pick History

branch: claude/feature/user-pick-history

## Summary

Users currently have no way to see their pick record across weeks — they can only query one week at a time via `GET /user/picks?year=&week=`. This feature adds a summary endpoint that returns a user's pick history across all weeks they participated in, along with win/loss counts so they can track their season performance.

## Functional Requirements

- Add `GET /user/history` endpoint that returns the authenticated user's pick history across all weeks
- Each entry in the response should include: year, week, total picks made, correct picks, and incorrect picks (games that have a final score)
- Picks for games that are not yet complete should be counted as pending, not correct or incorrect
- The response should be sorted by year and week descending (most recent first)
- The endpoint must be authenticated (JWT cookie required)
- Add the corresponding shared type to `packages/shared/types/cfb-pickem-api.ts`
- Add a frontend API function in `src/apis/userRequests.ts` to call the new endpoint

## Possible Edge Cases

- User has made no picks at all — return an empty array, not a 404
- A week has picks but all games are still pending — correct/incorrect should be 0, pending should equal total
- A game is partially scored (some games finished, some not) — counts should reflect actual state per game
- Games with null final scores should be treated as pending regardless of whether kickoff has passed

## Acceptance Criteria

- `GET /user/history` returns 200 with a list of week summaries for the authenticated user
- Each summary includes `year`, `week`, `total`, `correct`, `incorrect`, `pending`
- Unauthenticated requests return 401
- A user with no picks receives `{ history: [] }`
- Correct + incorrect + pending always equals total for each week entry

## Open Questions

- Should the endpoint support pagination, or is returning all weeks acceptable given the season is ~20 weeks long? - return all weeks for a specific year is good.
- Should weeks where the user made zero picks be omitted (current assumption: yes — only include weeks with at least one pick)? - sure that sounds fine.
- Is there a need to expose individual pick details here, or is the week-level summary sufficient? - week level summary is good.

## Testing Guidelines

Create a test file in `packages/backend/tests/` covering:
- Returns empty history for a user with no picks
- Returns correct week summaries with accurate correct/incorrect/pending counts
- Pending count is correct when games have no final score
- Returns 401 when not authenticated

## Personal Opinion

This is a straightforward, valuable addition — pick'em games live and die by their leaderboard and history features. Users want to know how they're doing across the season. The scope is modest: one new DB query, one route, one shared type. The main risk is getting the correct/incorrect logic wrong by conflating "game is over" with "game has a score" — those need to be handled the same way the existing picks display logic handles it (checking for null points). Low complexity, good value, no concerns.
