# Spec for sync-results-from-cfbd

Title: Sync Results from CFBD
Branch: claude/feature/sync-results-from-cfbd
Spec file: context/specs/sync-results-from-cfbd.md

## Summary

Replace the manual "mark game complete" flow with a platform-admin-only "sync results" action that re-imports game data (scores, completion status) from CFBD for a given week. When all games in a league's pool are complete after a sync, the `rankings_updated` notification fires automatically. This eliminates the manual mark-complete step and removes the league admin's ability to write global game state.

## Functional Requirements

- Add a "Sync Results" button in the platform admin UI for a selected week, alongside the existing week management controls.
- Syncing re-fetches game data from CFBD for the selected week and upserts into `admin.games` (scores, `completed`, `winningTeam`) — the same logic already used during initial week import.
- After a sync, for every league that has games in that week, check `isWeekComplete`. If all of a league's games are complete, dispatch the `rankings_updated` notification for that league.
- Sync is platform admin only (`requireRole('admin')`). League admins have no sync capability.
- Remove the platform admin "mark game complete" endpoint (`POST /admin/games/complete`) and its single-game manual flow.
- Remove the league admin "mark week complete" endpoint (`POST /admin/leagues/:leagueId/games/complete`) and its button in `LeagueAdminSection`.
- The sync action returns a summary: how many games were updated, how many flipped to completed, and which leagues had notifications dispatched.
- If CFBD returns no data for the week, return an error rather than silently doing nothing.

## Possible Edge Cases

- A sync runs mid-game: some games complete, others still in progress. Only fully completed games flip; the week stays open for those leagues until the next sync.
- A game was previously manually corrected via `correctGameScore`. The sync must skip any game that has a correction audit log entry — the corrected score takes precedence over whatever CFBD returns.
- Multiple leagues share the same game in their pool. The notification should fire per league independently once that league's full pool is complete.
- CFBD API is slow or times out during sync. The response should not hang; handle timeout gracefully and report partial results.
- A week has no leagues with games yet. Sync still updates the global game cache; no notifications fire.

## Acceptance Criteria

- [ ] Platform admin can trigger a sync for a specific week from the admin UI.
- [ ] After sync, games with final scores in CFBD are marked `completed = true` with correct scores and `winningTeam` in `admin.games`.
- [ ] If all games in a league's pool are complete after sync, `rankings_updated` notification is dispatched for that league.
- [ ] Notifications are not re-dispatched if the week was already complete before the sync.
- [ ] The manual "mark game complete" button and endpoint are removed from the platform admin UI and API.
- [ ] The "mark week complete" button and endpoint are removed from the league admin UI and API.
- [ ] Sync endpoint returns a meaningful summary (games checked, games updated, leagues notified).
- [ ] Sync is inaccessible to league admins (403 if attempted).
- [ ] Games with a correction audit log entry are skipped during sync; their corrected scores are preserved.

## Open Questions

- ~~Should sync skip games with a correction audit log entry?~~ **Decided: skip them.** Corrected scores take precedence over CFBD data.
- Should there be a cron job that auto-syncs results on a schedule (e.g. Sunday night), or always manual? A cron would reduce admin burden but adds complexity and could silently overwrite corrections.
- Should the sync UI show a diff of what changed (which games flipped, what scores came in) before confirming, or just do it immediately?

## Testing Guidelines

- Unit test the sync logic: verify that games already completed are not re-dispatched, that `isWeekComplete` is checked per league, and that notifications fire only when the full pool is done.
- Test the CFBD timeout/error path returns a useful error response rather than hanging.
- Test that a game with a correction audit entry is skipped during sync and its corrected score is preserved.
- Test the 403 response when a league admin attempts to call the sync endpoint.

## Personal Opinion

This is a good change. The manual mark-complete flow was always a workaround for the absence of a sync mechanism, and it created a privilege problem where league admins could write global game state. Replacing it with a single platform-admin sync action is cleaner and more honest about what the operation actually does.

The main concern is the correction-overwrite edge case — it's rare but could cause real problems if a platform admin syncs after correcting a CFBD error and the wrong score comes back from the API. Deciding the skip-vs-overwrite policy before implementing will save a rework later.

A future cron job for auto-sync is worth considering but should be a separate feature. Get the manual sync working and trusted first.
