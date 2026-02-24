# Spec for Notification System

branch: claude/feature/notification-system

## Summary

Add a multi-channel notification system to the CFB Pick'em app. Users will receive notifications via email (AWS SES) and/or NTFY (self-hosted) based on their preferences. Three notification types are supported: games becoming available to pick, a 1-hour deadline reminder before picks lock, and rankings being updated after all games complete. A Postgres-backed notification log prevents duplicate sends. All scheduling runs inside the Hono process via a cron job. Event-driven notifications (games ready) are triggered directly from admin route handlers. Score refresh and rankings notification are fully automated — no admin action required after games are published.

## Functional Requirements

### Notification Types
- **Games Ready**: Sent when an admin publishes a week's games, making them available for users to pick. Triggered from the admin route handler at the point of publication.
- **Picks Deadline Reminder**: Sent 1 hour before the first game of the week kicks off. All users who have not completed their picks receive this reminder. Triggered by the cron scheduler.
- **Rankings Updated**: Sent automatically once all games for the week are marked `completed = true` in the database. No admin action required. Triggered by the cron scheduler after a successful score refresh confirms full completion.

### Score Refresh (Automated)
- Starting at the last game's kickoff time for the week, the cron job fetches updated game data from the external API and upserts scores into the database using the existing `getGameData` + `upsertGameForWeek` logic.
- The refresh runs once per hour until all games for the week have `completed = true`, or until a hard cap of 12 hours past the last game's kickoff is reached.
- Completion is determined by querying Postgres: all games for the week must have `completed = true`.
- CFBD signals completion via a `completed` boolean field. NCAA signals completion via `gameState === 'final'` or `finalMessage === 'FINAL'`. The existing API adapters normalize these into the shared `completed` boolean already stored in the database.
- Once all games are complete, the "Rankings Updated" notification fires (once, per the notification log).

### Channels
- **Email (SES)**: Uses AWS SES for transactional email delivery. Each notification type has a corresponding email template.
- **NTFY**: Uses the user's self-hosted NTFY server. Each user has a personal topic derived from their userId (e.g. `cfb-pickem-{userId}`). Notifications are sent via HTTP POST to the NTFY server.

### User Preferences
- Users can opt in or out of each notification type independently.
- Users can opt in or out of each channel independently.
- A user must have a valid email address on file to receive email notifications.
- A user must configure their NTFY server URL to receive NTFY notifications. The topic is auto-derived from their userId and does not need to be user-configured.
- Preference management is available through user account settings.

### Notification Log
- Every sent notification is recorded in a `notification_log` Postgres table with: user ID, week identifier (year + weekNumber), notification type, channel, and sent timestamp.
- Before sending any notification, the system checks the log to prevent duplicates for the same user/week/type/channel combination.
- The log is the sole mechanism for deduplication — no in-memory state is relied upon.

### Cron Scheduler
- Runs inside the Hono server process on startup.
- Polls every 15 minutes.
- On each tick, performs two independent checks:
  1. **Deadline reminder check**: Is the current time within 15 minutes before the 1-hour-prior-to-first-game-kickoff mark? If yes, send reminders to users with fewer picks than the total available games for the week.
  2. **Score refresh check**: Is the current time at or past the last game kickoff of the current week, and are there still incomplete games? If yes, and if at least 60 minutes have passed since the last refresh, fetch and upsert scores. If all games are now complete and the rankings notification hasn't been sent, fire it.
- The score refresh is throttled to once per hour via a `last_refresh_at` timestamp to avoid unnecessary external API calls.
- If the process restarts, the notification log prevents re-sending to users who already received a notification.
- If the process is down during a notification window, that window is silently missed — this is an accepted limitation.
- The score refresh stops after all games are `completed = true` or after the 12-hour hard cap, whichever comes first.
- The score refresh only runs for the current week — no backfill for past weeks.

### Admin Triggers
- The "Games Ready" notification fires inside the existing `POST /admin/week` route handler after games are successfully imported.
- No admin action is required for score refresh or rankings notification — both are fully automated.

## Possible Edge Cases

- A user has no email address set but has email notifications enabled — skip silently, do not error.
- A user has not configured a NTFY server URL but has NTFY enabled — skip silently.
- Admin publishes games multiple times for the same week (e.g. correcting a mistake) — the notification log prevents re-notifying users for the same week/type/channel.
- Cron fires multiple times near the deadline boundary — the notification log prevents duplicates.
- SES send fails for a user — log the failure, continue to next user, do not abort the batch.
- NTFY HTTP POST fails — same as SES: log and continue.
- The first game kickoff is in the past when the cron runs (week already started) — no deadline reminder should be sent.
- The external API never returns `completed = true` for all games (e.g. a game is cancelled or the API has stale data) — the 12-hour hard cap stops the refresh loop. The rankings notification is not sent in this case.
- Score refresh runs but no scores have changed (API returns same data) — no notification is sent; the completion check must confirm all games are done before firing.
- User opts out of notifications after "Games Ready" has already been sent — the opt-out is respected for all subsequent notifications.
- The last game kickoff is unknown (no games imported yet) — the score refresh check is skipped gracefully.

## Acceptance Criteria

- When an admin publishes a week's games, all opted-in users receive a "Games Ready" notification on their configured channels.
- Users who have not completed their picks receive a reminder notification approximately 1 hour before the first game of the week kicks off.
- Users who have already completed all picks for the week do not receive the deadline reminder.
- Once all games for the week are complete, all opted-in users receive a "Rankings Updated" notification without any admin intervention.
- No user receives the same notification (type + week + channel) more than once, even if the cron runs multiple times or the server restarts.
- Score refresh stops automatically once all games are complete or the 12-hour cap is reached.
- Users can enable/disable each notification type and each channel independently through their account settings.
- Users can provide and update their email address and NTFY server URL in account settings.
- Notification send failures (SES or NTFY) are logged and do not crash the process or abort other notifications in the batch.
- The cron job does not send a deadline reminder if the pick deadline has already passed.

## Resolved Questions

- **Email verification**: Users must confirm their email address before receiving email notifications. An email verification flow is required.
- **Notification log viewer**: Out of scope for now — server-log-level visibility is sufficient. Can be added as a separate feature later.
- **Test notification**: A "send test notification" action should be available in user account settings so users can verify their NTFY setup works.
- **Email sender address**: Configurable via environment variable (e.g. `NOTIFICATION_FROM_EMAIL`). Display name is "CFB Pick'em".
- **Deadline reminder eligibility**: Send to any user with fewer picks than the total number of available games for the week.
- **Score refresh scope**: Current week only — no backfill for past weeks.

## Testing Guidelines

Create test file(s) in the `./tests` folder for the new feature. Focus on the following without going overboard:

- Notification log deduplication: verify that sending the same type/week/channel/user combination twice results in only one send.
- Deadline reminder logic: verify that the reminder fires when within the window, does not fire when the deadline has passed, and does not fire when the deadline is still far out.
- Score refresh logic: verify that the refresh fires when past the last game kickoff, stops when all games are complete, and stops at the 12-hour hard cap.
- Rankings notification: verify it fires once all games are complete and does not re-fire on subsequent cron ticks.
- User preference filtering: verify that users opted out of a notification type or channel are excluded from sends.
- Admin trigger hook: verify that publishing games via `POST /admin/week` calls the notification dispatch function.
- Graceful failure: verify that a failed SES or NTFY send does not abort remaining notifications in the batch.

## Personal Opinion

This is a good addition — deadline reminders will meaningfully reduce "I forgot to pick" complaints, and automating the score refresh removes the need for admin follow-up after game day. That's a real UX improvement on both ends.

Concerns:
- NTFY adoption will likely be low among a general user base. Worth building given the self-hosted server is already available, but most users will use email.
- The hourly polling window means the rankings notification could arrive up to an hour after the last game finishes. Acceptable for a pick'em app.
- If the user base grows significantly, sending individual SES emails per cron tick could get slow. Fine for now; batching may become necessary later.
- The "process down during window = missed notification" limitation is worth communicating to admins.
- Email verification is worth considering upfront — sending to unverified addresses risks SES sender reputation issues.
- The 12-hour hard cap is a guess. Bowl games and late-night games could push past it in edge cases — consider making this configurable or slightly more generous (e.g. 16 hours).
