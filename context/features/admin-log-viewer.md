# Plan: Admin Notification Log Viewer

## Context
Admins need a way to audit which notifications were sent, to whom, and when — without SSH access. The `user.notification_log` table already captures all sent notifications (email per user, broadcast channels via userId=0 sentinel). This plan adds a read-only "Notification Log" tab to the admin dashboard backed by a new protected endpoint.

---

## Step 1 — DB Migration: Add `sent_at` Index

File: `packages/backend/src/db/migrations/` (new file, generated via `pnpm generate`)

Add an index on `user.notification_log(sent_at DESC)` to support the ordered, capped query efficiently. After generating the migration file, run it with `pnpm migrate`.

Schema change in `packages/backend/src/db/schema/users.ts` — add an `index` call on `sentAt` inside the table definition.

---

## Step 2 — Shared Type

File: `packages/shared/types/cfb-pickem-api.ts`

Add a new exported interface:

```typescript
export interface NotificationLogEntry {
  id: number;
  userId: number;
  year: number;
  weekNumber: number;
  notificationType: NotificationType;
  channel: NotificationChannel;
  sentAt: string; // ISO string
  recipient: string; // "Broadcast" | displayName | "Deleted user"
}
```

---

## Step 3 — DB Query Function

File: `packages/backend/src/db/dbNotificationFunctions.ts`

Add `returnNotificationLogs(limit: number)`:
- SELECT all columns from `notification_log`, plus `users.displayName` via LEFT JOIN on `userId`
  - Join is: `.leftJoin(users, eq(notificationLog.userId, users.userId))`
  - Since userId=0 doesn't match any real user row, displayName will be null for broadcast rows — no special join condition needed
- In application code, map `displayName`:
  - `userId === 0` → `recipient = "Broadcast"`
  - `userId > 0` and `displayName === null` → `recipient = "Deleted user"`
  - otherwise → `recipient = displayName`
- ORDER BY `sentAt DESC`, LIMIT `limit`
- Also run a separate COUNT query for total: `db.select({ count: sql<number>`count(*)::int` }).from(notificationLog)`
- Return `{ entries: NotificationLogEntry[], total: number }`

---

## Step 4 — Admin Endpoint

File: `packages/backend/src/routes/admin.ts`

Add `GET /notification-logs`:
- Middleware chain: `apiRateLimit` → `authMiddleware` → `requireRole('admin')`
- No query params needed (limit is hardcoded to 500)
- Calls `returnNotificationLogs(500)` from Step 3
- Responds: `c.json({ entries, total })`

The Hono RPC chain must remain unbroken (method chaining, no intermediate assignments) for `AppType` inference to work.

---

## Step 5 — Frontend API Function

File: `packages/frontend/src/apis/adminRequests.ts`

Add `getNotificationLogs()`:
- Calls `client.api.admin['notification-logs'].$get()`
- Returns `{ success: true, data: { entries, total } }` or `{ success: false, error: string }`
- Follows the same `{ success, data?, error? }` wrapper pattern used by all other functions in this file
- Import `NotificationLogEntry` from shared types

---

## Step 6 — NotificationLogSection Component

File: `packages/frontend/src/components/admin/NotificationLogSection.tsx` (new file)

Structure:
- Wrapped in `<DashboardCard>` (match other admin sections)
- State: `entries`, `total`, `loading`, `error`, `channelFilter`, `typeFilter`
- `useEffect` on mount fetches from `getNotificationLogs()` — same fetch pattern as `UsersSection`
- "Refresh" button re-runs the same fetch, setting loading=true first
- If `total > entries.length`, show a note: `Showing 500 of {total} entries`
- Filter controls: MUI `<ToggleButtonGroup>` or `<Select>` for channel and notification type — client-side filter, no re-fetch
- MUI `<Table>` with columns: Date/Time | Type | Channel | Week | Recipient
  - `sentAt` formatted as locale date+time string
  - `channel` shown as a capitalized label or small chip
  - `notificationType` shown as a human-readable label (e.g. `games_ready` → "Games Ready")
- Empty state: italic secondary Typography "No notifications have been sent yet."
- Error state: MUI Alert

---

## Step 7 — Dashboard Tab

File: `packages/frontend/src/pages/Dashboard.tsx`

- Import `NotificationLogSection`
- Add a new `<Tab>` in the admin tabs row (after "Users", before "Dev Tools" if present) with label "Notification Log" and an appropriate icon (e.g. `NotificationsIcon` from MUI)
- Extend the tab content ternary to include `<NotificationLogSection />` at the new index
- Tab is inside the `isAdmin` conditional — non-admins never see it

---

## Step 8 — Tests

### Backend: `packages/backend/tests/routes/adminNotificationLogs.test.ts` (new file)

Follow the pattern from `adminUsers.test.ts`:
- `beforeAll`: call `seedTestData()`; insert log entries using `createTestNotificationLog()` from `db-utils.ts` for both a real user and userId=0
- Test cases:
  - `GET /api/admin/notification-logs` → 401 with no token
  - `GET /api/admin/notification-logs` → 403 with non-admin token
  - `GET /api/admin/notification-logs` → 200 with admin token; response has `entries` array and `total` number
  - Each entry has `id`, `sentAt`, `notificationType`, `channel`, `year`, `weekNumber`, `recipient`
  - Entry with userId=0 has `recipient: "Broadcast"`
  - Entry with real userId has `recipient` equal to the user's displayName
  - Returns `{ entries: [], total: 0 }` when table is empty

### Frontend: `packages/frontend/tests/unit/apis/adminRequests.test.ts`

Add to existing file (or create a sub-describe block):
- Add MSW handler for `GET /api/admin/notification-logs` in `packages/frontend/tests/mocks/handlers.ts`
- Test: success path returns `{ success: true, data: { entries, total } }`
- Test: 403 response returns `{ success: false, error: 'Forbidden' }`
- Test: network error returns `{ success: false, error: 'Request failed' }`

---

## Critical Files

| File | Change |
|------|--------|
| `packages/backend/src/db/schema/users.ts` | Add index on `sentAt` |
| `packages/backend/src/db/migrations/` | New generated migration file |
| `packages/shared/types/cfb-pickem-api.ts` | Add `NotificationLogEntry` interface |
| `packages/backend/src/db/dbNotificationFunctions.ts` | Add `returnNotificationLogs()` |
| `packages/backend/src/routes/admin.ts` | Add `GET /notification-logs` |
| `packages/frontend/src/apis/adminRequests.ts` | Add `getNotificationLogs()` |
| `packages/frontend/src/components/admin/NotificationLogSection.tsx` | New component |
| `packages/frontend/src/pages/Dashboard.tsx` | Add tab + render |
| `packages/backend/tests/routes/adminNotificationLogs.test.ts` | New backend tests |
| `packages/frontend/tests/mocks/handlers.ts` | Add MSW handler |
| `packages/frontend/tests/unit/apis/adminRequests.test.ts` | Add frontend API tests |

---

## Verification

1. Run `pnpm migrate` — confirm migration applies cleanly
2. `npx tsc --noEmit -p packages/backend/tsconfig.json` — no type errors
3. `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` — no type errors
4. `pnpm test:backend` — new `adminNotificationLogs.test.ts` passes all cases
5. `pnpm test:frontend` — new API request tests pass
6. Start dev servers (`pnpm dev:backend`, `pnpm dev:frontend`), log in as admin, navigate to Dashboard → confirm "Notification Log" tab is present, loads entries, filter controls work, Refresh button re-fetches
