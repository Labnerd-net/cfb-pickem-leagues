# Spec for Admin User Tools

Title: Admin User Tools
Branch: claude/feature/admin-user-tools
Spec file: context/specs/admin-user-tools.md

## Summary

Extend the admin Users section with two operations that are useful at small scale: a CSV export of user and pick data, and a manual notification broadcast. Bulk role assignment is explicitly out of scope — with 15–20 users and at most 2 admins, the existing per-user role toggle is sufficient.

## Functional Requirements

### CSV Export

- An "Export CSV" button appears in the Users section header (alongside the existing table).
- Clicking it triggers a client-side download of a `.csv` file — no new backend route required; all data is already loaded.
- The CSV includes one row per user with columns: Display Name, Email, Roles, Pick Count (total picks submitted across all weeks/years), Correct Picks (total correct), Accuracy (percentage, 0 if no picks).
- Pick count and correct pick data must be fetched from the backend before export; a new `GET /admin/users/export` endpoint (or reuse/extend an existing one) should return the enriched data.
- The downloaded filename should be `users-export-<YYYY-MM-DD>.csv`.

### Manual Notification Broadcast

- A "Send Notification" button appears in the Users section header.
- Clicking it opens a dialog with:
  - A subject/title text field (required, max 100 characters).
  - A message body textarea (required, max 1000 characters).
  - A confirm/send button and a cancel button.
- On submit, call a new `POST /admin/notifications/broadcast` endpoint that accepts `{ subject, message, overrideEmailPreferences: boolean }`.
- The endpoint requires admin role and validates inputs with Zod.
- A new `dispatchAdminBroadcast(subject, message)` function in `dispatcher.ts` handles delivery — it does **not** use the existing `dispatchNotification` template system.
- The dialog includes an "Override email preferences" checkbox (unchecked by default). When unchecked, email is sent only to opted-in users (via `returnEmailOptedInUsers`). When checked, email is sent to all users with a verified email address regardless of notification preferences.
- Broadcast channels (ntfy, Telegram, Discord) are always sent to if enabled — they have no per-user opt-in preferences to override.
- **Notification log**: add `'admin_broadcast'` to the `NotificationType` union in shared types. The backend resolves the current active week at send time and logs with that year/weekNumber so the entry has meaningful context in the notification log. If no active week exists (off-season), use the next upcoming season year with `weekNumber=0` — the next season year is determined by looking at the most recent year in the weeks table and incrementing it if the season is complete, or using the current calendar year if no weeks exist at all. No deduplication — each broadcast is intentionally unique.
- The dialog shows a success or error message after the call completes.

## Possible Edge Cases

- **CSV with zero picks**: users who have never submitted picks should show `0 / 0 / 0%` — not an error.
- **Export before users load**: the Export button should be disabled while users are still loading.
- **Concurrent sends**: no deduplication — each admin broadcast is intentionally unique. Double-sending is possible if the admin clicks twice; the dialog should disable the send button after the first click.
- **Email to all vs. opted-in**: the broadcast respects the existing `returnEmailOptedInUsers` opt-in list. Users who have opted out of all notifications will not receive the email, which is intentional.
- **No active week at send time (off-season)**: log with the next upcoming season year and `weekNumber=0`. The notification log display should render `weekNumber=0` as "Pre-season" or "–" rather than "Week 0".

## Acceptance Criteria

- Clicking "Export CSV" in the Users section downloads a valid `.csv` file with the correct columns and one row per user.
- Pick count and correct pick totals in the export match what the leaderboard and pick history endpoints report.
- Clicking "Send Notification", filling the form, and confirming successfully invokes `dispatchNotification` on the backend.
- Invalid inputs (empty subject/message, exceeding max length) return 400 and display an error in the dialog.
- Both features require admin role — unauthorized requests return 401/403.
- Admin broadcast entries appear in the notification log with the correct active week, or with the next season year and `weekNumber=0` if sent off-season (rendered as "Pre-season" or "–").

## Open Questions

- Should the CSV export include deleted/soft-deleted users, or only active users? (Current `returnUsers` behavior returns only active users — probably fine to match that.)
- When `overrideEmailPreferences=true`, fetch all users with a verified email rather than filtering by opt-in. A new DB helper (e.g. `returnEmailVerifiedUsers`) may be needed, or `returnUsers` filtered client-side in the dispatcher.

## Testing Guidelines

- **Backend — `POST /admin/notifications/broadcast`**: route tests covering 401 (unauthenticated), 403 (non-admin), 400 (empty subject, empty message, over max length), and 200 (valid call dispatches broadcast). Use a spy on `dispatchAdminBroadcast` to avoid real sends in tests.
- **Backend — CSV export endpoint**: route test that returns enriched user rows including pick counts; verify shape of returned data.
- No frontend unit tests needed beyond what Vitest already covers for existing form schemas.

## Personal Opinion

Good scope call removing bulk role assignment — it adds UI complexity for a problem that doesn't exist at this user count. The two remaining operations (CSV export, manual notification) are genuinely useful for a small league admin.

The free-form broadcast is better than pre-defined types — simpler dialog and more useful. The main complexity is `notification_logs`: the backend resolves the active week at send time, which is the right call semantically. The off-season fallback (next season year, `weekNumber=0`) is semantically clean — the log UI just needs to render `weekNumber=0` as "Pre-season" rather than "Week 0".

The CSV export is straightforward. The only non-trivial part is deciding whether to fetch pick aggregates from a new endpoint or reuse existing ones — the leaderboard endpoint already computes correct pick counts, so it may be worth reusing that data rather than writing a new DB query.
