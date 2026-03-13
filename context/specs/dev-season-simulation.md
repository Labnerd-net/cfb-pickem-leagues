# Spec for dev-season-simulation

branch: claude/feature/dev-season-simulation

## Summary

Add a developer/testing mode that allows simulating a partial college football season without relying on live game data or the current system clock. The goal is to enable end-to-end testing of the full pick'em flow: browsing available games, submitting picks, advancing time past game deadlines, recording game outcomes, viewing leaderboard updates, and triggering notifications — all in a controlled local environment.

Two complementary approaches should be supported:
1. **Seed data approach** — A script or admin tool that inserts realistic historical game/week data (e.g. a few weeks from a past CFB season) directly into the database, bypassing external API calls.
2. **Clock override approach** — A mechanism to set a fake "current time" the application uses instead of `Date.now()`, so that deadlines, pick windows, and game start times resolve correctly against the seeded historical data.

## Functional Requirements

- A seed script (or npm/pnpm script) that inserts 2–4 weeks of historical CFB game data into the `admin` schema, including weeks, games with realistic kickoff times, and expected winners/final scores.
- The seed data must be self-contained and not require any external API key or network call.
- The backend must support a "fake clock" time override, configurable via an environment variable (e.g. `DEV_CURRENT_TIME=2024-09-14T18:00:00Z`), so that pick deadlines and game result visibility resolve against that time instead of wall clock time.
- An admin-only endpoint (or extension of an existing one) to mark seeded games as completed and set winners, simulating score ingestion without an external data source.
- The leaderboard must reflect pick correctness against the simulated results once games are marked complete.
- Notifications (email and/or ntfy) must fire when game outcomes are recorded for seeded data, so the notification pipeline can be tested end-to-end.
- The seed and clock override must be clearly gated to non-production environments (e.g. `NODE_ENV !== 'production'`).
- A teardown/reset script to wipe seeded data and restore a clean state.

## Possible Edge Cases

- Seeded games may conflict with real data if the dev DB has previously fetched live data; the seed script should handle conflicts gracefully (upsert or clear first).
- If `DEV_CURRENT_TIME` is set to a time after all games have started, the pick submission window will be closed — the seed data should include at least one week where the fake clock is set before kickoff so picks can actually be submitted.
- The fake clock must propagate to all time-sensitive logic: pick deadline enforcement, "game started" checks, and result visibility. Any place that calls `new Date()` or `Date.now()` directly must go through a shared utility.
- Notifications may fire multiple times if the result-recording endpoint is called repeatedly; the simulate-results flow should be idempotent or warn on re-runs.
- The teardown script should not accidentally delete real production data; it should only target rows inserted by the seed script (e.g. via a known year/week range or a seed marker).

## Acceptance Criteria

- Running the seed script populates the DB with at least 2 weeks of games and can be re-run safely.
- With `DEV_CURRENT_TIME` set before week 1 kickoffs, a user can log in and submit picks for week 1 games.
- Advancing `DEV_CURRENT_TIME` past kickoff locks the pick window for those games.
- Marking games as complete via the admin endpoint updates scores/winners in the DB.
- The leaderboard correctly awards points to users who picked the winning team.
- At least one notification (email or ntfy) fires when a game result is recorded, confirmed by logs or a test notification sink.
- Running the teardown script removes all seeded data without affecting other DB rows.
- All of the above works with `NODE_ENV=development` and fails to activate in `NODE_ENV=production`.

## Open Questions

- Should the seed data be hardcoded (a static JSON/TS fixture file) or pulled from a committed snapshot of a real API response? Hardcoded is simpler and more portable.  - can we use real data and hardcode it for future use?
- Should the fake clock be settable at runtime via an admin API endpoint (no server restart needed), or is an env var sufficient? A runtime endpoint would be more ergonomic for iterating through a simulated week but adds complexity.  - Start with the env var
- Should "mark game complete" be a new admin endpoint, or extend the existing admin game management routes?  - whatever you think is best
- Is there value in a UI panel (admin-only) that shows the current fake time and lets you advance it, rather than requiring env var changes and restarts? - there is definate value in that, but I can try the env var first.  Plus, it shouldn't be visible all the time, just during dev mode.
- Should notifications be sent to real addresses during simulation, or should there be a dev-mode notification sink (log-only) regardless of `SKIP_EMAIL_SEND`?  - just use SKIP_EMAIL_SEND so I can verify notifications.  If I don't want to test them, then I sill set that env.

## Testing Guidelines

Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:

- The fake clock utility returns `DEV_CURRENT_TIME` when set and falls back to real wall clock when unset.
- The fake clock is never active when `NODE_ENV=production`, even if `DEV_CURRENT_TIME` is set.
- Pick submission is blocked when fake clock time is after game kickoff.
- Pick submission succeeds when fake clock time is before game kickoff.
- The seed script is idempotent (second run does not duplicate rows).
- Marking a game complete triggers the notification dispatcher.

## Personal Opinion

This is a genuinely good idea and the right way to test a time-sensitive app. The gap between dev and prod behavior is a real maintenance hazard in pick'em apps, and testing with live data is fragile. A few concerns:

- **The fake clock approach has high implementation risk if `new Date()` is called in many scattered places.** A centralized `getNow()` utility needs to be established first, and all existing usages audited and migrated. That audit could surface unexpected spots. Plan for it explicitly.
- **Two parallel mechanisms (seed data + fake clock) is the right call**, but it doubles the surface area. Keep the fake clock minimal — env var only, no runtime API — unless there's a clear reason to complicate it.
- **The notification test risk**: if `SKIP_EMAIL_SEND=false` and real email addresses are in the DB, simulating results could spam real users. Make sure the teardown or test-mode documentation is explicit about this.
- Overall complexity is medium-high but justified. This will pay off every time a new pick/leaderboard/notification feature needs to be validated.
