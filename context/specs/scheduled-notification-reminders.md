# Spec for Scheduled Notification Reminders

Title: Scheduled Notification Reminders
Branch: claude/feature/scheduled-notification-reminders
Spec file: context/specs/scheduled-notification-reminders.md

## Summary

The current notification system is event-driven only — notifications fire in response to events (games ready, picks reminder ~1hr before kickoff, rankings updated). This feature adds two time-based (scheduled) notifications driven by the existing cron loop:

1. **24-hour picks reminder** — fires ~24 hours before the first kickoff of the current week, giving users time to research before the deadline. Uses the same deduplication pattern as the existing 1-hour reminder.
2. **Season summary** — fires once after all weeks for a season are marked complete, sending a final standings/leaderboard notification.

Admin can toggle each of these on or off from a new Notification Settings section in the admin panel. Settings are stored in the database (a simple key-value or explicit columns table), so they persist across restarts and don't require env var changes.

## Functional Requirements

- Add a `picks_reminder_24h` notification type alongside the existing `picks_reminder` type.
- The 24hr reminder fires when now is in the window [firstKickoff - 25h, firstKickoff - 24h], mirroring the existing 75–60 min window pattern in `cronLogic.ts`.
- The 24hr reminder uses existing deduplication (`notification_logs`) so it cannot fire twice for the same week.
- Add a `season_summary` notification type that fires once after the final week of a season is complete (all games finished). Detection: after `rankings_updated` fires and no subsequent week exists for the same year.
- Both new notification types are added to the `NotificationType` union in shared types.
- New email templates for both: `picksReminder24hTemplate` and `seasonSummaryTemplate`.
- Admin settings: a new `admin_settings` table (or a single-row config table) with boolean columns `picks_reminder_24h_enabled` (default `true`) and `season_summary_enabled` (default `true`).
- The cron logic checks these flags before dispatching either new notification.
- Admin UI: a new "Notification Settings" section in the admin panel showing toggles for each scheduled notification type. Saves immediately on toggle change (no save button needed, or a simple save button).
- The existing 1-hour `picks_reminder` and other notifications are unaffected.

## Possible Edge Cases

- Season summary fires too early if the last week's games are marked complete but another week is later added for the same year. The deduplication log prevents a double-send but the notification would have already gone out prematurely — acceptable given admin controls the week schedule.
- If the server restarts within the 24hr reminder window, the deduplication log prevents a duplicate send (same as the 1hr reminder).
- `season_summary` needs the leaderboard to be fetched for the entire year (not just current week) — reuse the existing `returnLeaderboard(year)` call pattern.
- The 24hr reminder template says "24 hours" but the window is actually a 1-hour check window starting at 25h before kickoff. The message should say "about 24 hours" to be safe.
- If there are no opted-in users and no broadcast channels configured, the notification still logs a dispatch attempt — this is existing behavior and acceptable.
- Admin settings table needs a seed/migration default row so the flags are available immediately after migration with no admin action required.

## Acceptance Criteria

- `shouldSend24hrReminder` unit tests cover: before window, inside window, after window, null kickoff.
- `shouldSendSeasonSummary` unit tests cover: week complete + no next week = true; week complete + next week exists = false; week not complete = false.
- Email templates for both new types render without errors.
- Admin toggle UI correctly reads current state on load and persists changes.
- Cron tick respects the admin flags — disabling a type prevents dispatch.
- Both new types appear in the `NotificationType` enum and notification log filter dropdown.
- Build passes with no TypeScript errors.

## Open Questions

- Should "season summary" also include a per-user breakdown (how many picks each user got right overall), or just the final leaderboard? Simpler to start with just the leaderboard.
- Is the single-row `admin_settings` table the right pattern, or should we use a generic key-value store for forward compatibility? A typed single-row table is simpler and more type-safe for a small app.
- Should the admin settings also expose a way to enable/disable the existing 1-hour reminder? Out of scope for now — keep the existing reminder always-on.

## Testing Guidelines

Create or extend test files in `packages/backend/tests/`:

- `cronLogic.test.ts`: Add tests for `shouldSend24hrReminder` (window boundary cases, null kickoff).
- `cronLogic.test.ts`: Add tests for `shouldSendSeasonSummary` (next-week detection logic).
- `templates.test.ts` (or inline): Smoke test `picksReminder24hTemplate` and `seasonSummaryTemplate` return non-empty subject/body.
- `adminSettings.test.ts` (route-level): Test `GET /admin/settings/notifications` returns defaults; `PATCH /admin/settings/notifications` persists changes; non-admin gets 403.

## Personal Opinion

The 24-hour reminder is a good addition — it's the notification users actually want (time to research picks). It's low complexity since it mirrors the exact existing cron pattern.

The season summary is a nice-to-have but has a non-trivial detection problem: determining "is this the last week of the season" requires either admin marking a season complete or inferring it from the absence of a next week. The inference approach can misfire if an admin adds a late week. This is acceptable risk for a small app but worth noting.

The admin toggle UI is the most significant complexity addition. For 15 users, env vars would have been fine, but the backlog explicitly calls for admin configurability, so a DB-backed toggle is the right call — it just means adding a new DB table, migration, API endpoint, and UI section. None of those are hard individually, but together they add up.

Overall: a reasonable medium-complexity feature. The 24hr reminder alone would be a small change; the season summary + admin settings push it to medium.
