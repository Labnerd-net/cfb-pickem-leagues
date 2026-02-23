# Spec for Leaderboard Dashboard

branch: claude/feature/leaderboard-dashboard

## Summary

The user dashboard currently has a "Leaderboard" card that displays "Coming soon...". The backend already exposes `GET /api/leaderboard?year=` and `GET /api/leaderboard/scores?year=&week=`. This spec covers wiring up that leaderboard card on the user dashboard to display a real season standings table using the existing backend endpoints.

## Functional Requirements

- The "Leaderboard" dashboard card fetches and displays the season standings for the current year
- Each row in the leaderboard shows a user's rank, display name, correct picks, total picks, and percentage (where available)
- The currently logged-in user's row is visually highlighted to make it easy to find their own position
- The leaderboard is read-only — users cannot interact with rows
- Data is fetched when the card mounts; a loading state is shown while the request is in flight
- If the fetch fails, an error message is shown within the card
- If there are no entries (no users have picks yet), a "No data yet" message is shown
- The year used for the leaderboard query defaults to the current season year (same year logic used elsewhere in the dashboard)

## Possible Edge Cases

- The current user may not appear in the leaderboard (e.g., they have not made any picks but the backend still returns them — confirm this is handled)
- A user with `percentage: null` (zero total picks) should display "—" or "0%" rather than crashing
- Long display names should be truncated or wrapped gracefully so the table layout does not break
- The leaderboard may have many users — decide whether to cap the display at a fixed number (e.g., top 20) or show all
- If the year cannot be determined from context, fall back to the current calendar year

## Acceptance Criteria

- The leaderboard card on the user dashboard renders a ranked table instead of "Coming soon..."
- The table columns are: Rank, Name, Correct, Total, %
- Rows are ordered by correct picks descending (backend already handles this ordering)
- The logged-in user's row is highlighted (e.g., different background color)
- A loading spinner or skeleton is shown while data is loading
- An inline error message is shown if the API call fails
- An empty-state message is shown if the leaderboard array is empty
- `percentage: null` is rendered as "—" not a crash or "null%"
- The component uses the Hono RPC client (`client.api.leaderboard.$get(...)`) — not raw fetch

## Open Questions

- Should the card also have a toggle or tab to switch between "Season" and "This Week" views (using the `/leaderboard/scores` endpoint), or is season-only sufficient for v1? - do season only for now
- Is there a cap on displayed rows, or should all users always be shown regardless of participant count?  - all users should be shown, but scroll if the list gets too long
- Should the percentage be shown as a formatted integer (e.g., "67%") or one decimal place (e.g., "66.7%")? - integer

## Testing Guidelines

Create a test file in `packages/frontend/tests/` covering:

- Renders the leaderboard table when the API returns data
- Highlights the current user's row
- Renders "—" for a user with `percentage: null`
- Shows a loading state while the request is in flight
- Shows an error message when the API call fails
- Shows an empty-state message when the leaderboard array is empty

## Personal Opinion

This is a straightforward wiring task — the backend and shared types are already done, and there is a card placeholder ready to be filled. The biggest design decision not covered by existing specs is whether to show season-only or add a per-week toggle. I would keep v1 to season standings only and add a week toggle as a separate spec. That avoids scope creep and gets something real in front of users quickly. The highlight of the current user's row is a small touch that makes the feature feel polished without extra complexity — worth including in v1.
