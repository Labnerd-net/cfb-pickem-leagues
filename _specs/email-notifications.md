# Spec for Email Notifications

branch: claude/feature/email-notifications

## Summary

Users currently have no way to know when the week's games are ready to pick, when their deadline is approaching, or when results are in. This spec adds transactional email notifications via Resend for three events: games published, deadline approaching, and week finalized. A cron job running alongside the API handles the time-based triggers.

## Functional Requirements

### Notification triggers

1. **Games published** — fired immediately when an admin sets the picked games for a week (`POST /admin/picks`). All registered users receive an email telling them the week's games are ready and linking to the picks page.

2. **Deadline approaching** — fired approximately 1 hour before the earliest `startTime` among the week's picked games. Users who have not yet submitted any picks for that week receive a reminder. Users who have already picked are not emailed.

3. **Week finalized** — fired when an admin marks a week as complete (new explicit admin action — see below). All users who submitted picks that week receive a results summary email.

### Admin action: finalize week

Add a `POST /admin/week/finalize` endpoint that marks a week as complete and triggers the results notification. This avoids polling to detect when all games are done — the admin makes the call explicitly after scores are confirmed.

Add a `finalized` boolean column to `adminWeeks`.

### User preferences

Users can opt out of any notification category. Add a `notificationPreferences` JSON column to `user.users` with three boolean flags: `gamesPublished`, `deadlineReminder`, `weekFinalized`. Default all to `true`.

Add a `PATCH /user/notifications` endpoint for users to update their preferences.

### Email provider

Use **Resend** (`resend` npm package). One env var: `RESEND_API_KEY`. Sending is fire-and-forget from the route handler — do not block the response waiting for the email API.

### Scheduler

Run a cron job that calls `GET /internal/cron/deadline-check` every 15 minutes. The endpoint is protected by a shared secret (`CRON_SECRET` env var, passed as `Authorization: Bearer` header). It checks whether any active week has a game with `startTime` between now and now+75 minutes that has not yet triggered a reminder, sends the reminder emails, and records that the reminder was sent.

Add a `reminderSentAt` timestamp column to `adminWeeks` to track whether the deadline reminder has fired for a week.

### Email content (minimal)

- **Games published**: subject "Picks are open — Week {N}", body lists the matchups and links to the picks page.
- **Deadline reminder**: subject "Picks close in ~1 hour — Week {N}", body lists which games the user has not yet picked (if any) and links to the picks page.
- **Week finalized**: subject "Week {N} results are in", body shows each game result and whether the user's pick was correct.

Plain text emails are acceptable for v1. No HTML templates required.

## Possible Edge Cases

- Admin calls finalize twice — idempotent: check `finalized` flag, no-op if already finalized, no duplicate emails.
- Admin publishes games, then replaces them before the deadline reminder fires — reminder should reflect the current game set at the time it fires, not the original set.
- User has no email address (shouldn't happen given registration requires one, but guard anyway).
- Resend API is down — log the error, do not crash the route handler or retry automatically in v1.
- User registers after games are published but before deadline — they miss the "games published" email. Acceptable for v1.
- Week with no picked games — finalize endpoint should reject with 422 if no games are marked picked.
- Cron endpoint called by an unauthorized client — reject 401 if `CRON_SECRET` header is missing or wrong.

## Acceptance Criteria

- Submitting picked games via `POST /admin/picks` sends a "games published" email to all users (who have that preference enabled) within a few seconds of the admin action.
- The cron endpoint, when called at the right time window, sends deadline reminder emails only to users who have not yet picked for that week, and only once per week.
- Calling `POST /admin/week/finalize` marks the week as finalized and sends results emails to users who submitted picks.
- Calling finalize a second time returns a 200 but sends no additional emails.
- Users with a notification preference set to `false` receive no email for that category.
- `RESEND_API_KEY` missing at startup logs a warning but does not crash the server (notifications simply no-op).
- All existing tests pass.

## Open Questions

- Should the cron job be a separate Docker container (recommended — clean separation) or a `setInterval` inside the API process (simpler but fragile on restarts)?
- Should the "week finalized" email include a full leaderboard or just per-user results? Full leaderboard is more engaging but requires more query work.
- Do we want a `GET /user/notifications` endpoint to retrieve current preferences, or just the PATCH for updating?
- Should users be able to subscribe/unsubscribe from a link inside the email (one-click unsubscribe), or only through the app UI?

## Testing Guidelines

- `POST /admin/picks` calls the notification service with the correct user list and week data.
- Notification service skips users with `gamesPublished: false` preference.
- Cron endpoint returns 401 with wrong secret, 200 with correct secret.
- Cron endpoint does not send emails if `reminderSentAt` is already set for the week.
- Cron endpoint does not email users who have already submitted picks for the week.
- `POST /admin/week/finalize` sets `finalized: true` on the week and is idempotent.
- Mock Resend in all tests — do not make real API calls.

## Personal Opinion

This is a good addition — a pick'em game without notifications will see low participation because users forget to pick. The three triggers cover the full user journey without over-notifying.

The only real decision is the cron job deployment. A separate container is cleaner but adds a step to the Dokploy setup. `setInterval` inside the API process works fine for a small app and avoids the extra container — acceptable for v1, refactor later if needed.

Resist the urge to build a full notification preferences UI in this pass. A simple PATCH endpoint is enough; a settings page can come later. Keep the email content plain text — HTML templates add time for minimal gain at this scale.

The "week finalized" explicit admin action is the right call. Polling for all games complete is fragile and timing-dependent. The admin knows when the week is done.

## Notes

  - The cron deployment is the only real architectural decision — setInterval inside the API process is fine for v1 given your Dokploy setup, but a separate container is cleaner long-term.                                   
  - The "week finalized" explicit admin action is worth thinking about before implementing — it adds a new concept (the finalized state) that touches the admin UI. You may want to spec the admin UI changes separately.        
  - The spec leaves the cron-job hosting open — Dokploy can run a second service that does nothing but hit the cron endpoint on a schedule, which avoids any in-process scheduling entirely.