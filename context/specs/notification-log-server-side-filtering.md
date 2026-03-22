# Spec for Notification Log Server-Side Filtering

Title: Notification Log Server-Side Filtering
Branch: claude/fix/notification-log-server-side-filtering
Spec file: context/specs/notification-log-server-side-filtering.md

## Summary

The notification log's channel and type filters are applied client-side after fetching a page of results from the server. This means the displayed "X total entries" count and pagination are based on the unfiltered DB total, not the filtered subset. When a user selects a channel or type filter, the count and page count are wrong and misleading.

Fix: move channel and type filtering to the server. The backend route and DB function should accept optional `channel` and `notificationType` query params, apply them as WHERE clauses in the query, and return a `total` that reflects only the matching rows.

## Functional Requirements

- `GET /admin/notification-logs` accepts two new optional query params: `channel` (one of the valid `NotificationChannel` values) and `notificationType` (one of the valid `NotificationType` values).
- When either filter param is present, the DB query filters rows accordingly and the returned `total` reflects only the filtered count.
- When no filter params are present, behavior is identical to current (all rows, full count).
- The frontend removes the client-side `entries.filter(...)` call and instead passes `channel` and `notificationType` as query params to `getNotificationLogs`.
- Re-fetching (with current filter state) is triggered whenever the filter dropdowns change, the page changes, or the refresh button is clicked — same as today.
- The displayed count and pagination use the server-returned `total` (which now reflects the active filter).

## Possible Edge Cases

- Switching a filter resets the page to 1 before fetching (already done for page state; must also trigger re-fetch with new filter values).
- Both filters can be active simultaneously — the backend should AND them.
- If a filter value sent by the frontend is not a valid enum value, the backend should reject it with a 400 (handled by Zod validation on the route).
- The `total` returned when filters are active could be 0 — the empty state ("No notifications have been sent yet.") should still render correctly.

## Acceptance Criteria

- Selecting "Email" channel filter shows only email rows, and the count/pagination reflect only email rows.
- Selecting a type filter shows only that type, count/pagination match.
- Both filters active simultaneously ANDs the results; count/pagination match.
- Clearing filters back to "All" returns full unfiltered count and all rows.
- Pagination works correctly against the filtered total (no blank pages, no missing rows).
- Invalid filter values sent to the backend return 400.

## Open Questions

- None. Server-side filtering is the clear correct approach.

## Testing Guidelines

Create or update tests in the backend `tests/` folder covering:
- `returnNotificationLogs` with no filters returns all rows and correct total.
- `returnNotificationLogs` with a channel filter returns only matching rows and correct filtered total.
- `returnNotificationLogs` with a type filter returns only matching rows and correct filtered total.
- `returnNotificationLogs` with both filters returns AND'd results and correct total.
- Route-level test: invalid `channel` value returns 400.
- Route-level test: invalid `notificationType` value returns 400.

Frontend tests are not required for this change (filter logic moves to backend; component behavior is straightforward pass-through).

## Personal Opinion

Good fix and the right call. The client-side filter approach is a common shortcut that breaks as soon as pagination is added — which it was in [31]. The two-line client filter should have been server-side from the start.

The change is small and well-scoped: touch `dbNotificationFunctions.ts`, the admin route, `adminRequests.ts`, and `NotificationLogSection.tsx`. No schema changes needed. Straightforward to test.

One concern: the Hono RPC client type for the route will need updating since the query schema is changing — make sure the frontend `getNotificationLogs` call picks up the new optional params through the typed client rather than being passed as raw strings.
