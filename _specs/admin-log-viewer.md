# Spec for admin-log-viewer

branch: claude/feature/admin-log-viewer

## Summary

Add a "Notification Log" tab to the admin dashboard that displays the contents of the existing `user.notification_log` table. This table already records every notification sent — including which user, week, type, and channel — so no new infrastructure is needed. Admins can use this to audit what was sent and to which channels.

## Functional Requirements

- A new "Notification Log" tab appears in the admin dashboard, visible only to admins
- The tab displays all rows from the `user.notification_log` table, ordered newest-first
- Each row shows: sent timestamp, notification type, channel, week (year + week number), and recipient
  - For email rows (userId > 0): recipient is the user's display name or email
  - For broadcast rows (userId = 0): recipient is shown as "Broadcast"
- Admins can filter the log by channel (email, ntfy, telegram, discord) and/or notification type
- A "Refresh" button re-fetches data on demand; no auto-polling required
- The backend exposes a new `GET /api/admin/notification-logs` endpoint that returns log entries joined with user display names where applicable

## Possible Edge Cases

- `userId = 0` is a sentinel for broadcast channels and does not correspond to a real user row — the query must handle this without a join error
- The table may be empty (e.g. fresh install or notifications disabled) — show an empty state, not an error
- Log entries can accumulate over multiple seasons; the endpoint should cap the response (e.g. most recent 500 entries) to avoid large payloads
- A user account may have been deleted after a notification was sent — the join should use a left join so orphaned log rows still appear, with a fallback label like "Deleted user"

## Acceptance Criteria

- Admins see a "Notification Log" tab in the dashboard; non-admins do not
- The tab renders a table of log entries with columns: Date/Time, Type, Channel, Week, Recipient
- Broadcast entries show "Broadcast" in the Recipient column
- Email entries show the user's display name (or email as fallback); deleted users show "Deleted user"
- Filtering by channel or notification type narrows the displayed rows client-side
- "Refresh" re-fetches from the API and replaces the current list
- `GET /api/admin/notification-logs` returns 401 for unauthenticated requests and 403 for non-admin users
- The endpoint returns at most 500 entries, newest first, and returns an empty array (not an error) when the table is empty

## Open Questions

- Should there be any date range filter (e.g. only show current season, or last 30 days) or is a row cap sufficient? - row cap is sufficient
- Should the tab show a total count of rows alongside the capped list, so admins know if they're seeing a truncated result? - yes, if that is practical

## Testing Guidelines

Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:

- `GET /api/admin/notification-logs` returns 401 with no auth token
- `GET /api/admin/notification-logs` returns 403 for a non-admin authenticated user
- `GET /api/admin/notification-logs` returns 200 with an array for an admin user
- Each entry in the response contains `sentAt`, `notificationType`, `channel`, `year`, `weekNumber`, and `recipient`
- Broadcast entries (userId = 0) have `recipient: "Broadcast"`
- Returns an empty array when the table has no rows
- Response is limited to 500 entries
- Frontend: Notification Log tab is not rendered for non-admin users
- Frontend: Channel filter hides non-matching rows without a new network request

## Personal Opinion

This is the right scope for now. The data is already there, the schema is clean, and the only real work is a joined query, one endpoint, and a table component. Much better than the full log-viewer idea which had a genuine infrastructure problem at its core.

The one thing I'd flag: the notification log table has no index beyond the unique constraint and the primary key. Once entries accumulate across a full season, `ORDER BY sent_at DESC LIMIT 500` may benefit from an index on `sent_at`. Worth adding in the migration for this feature rather than discovering it later.
