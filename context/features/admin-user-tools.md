# Plan: Admin User Tools

## Context

Two admin-only operations are being added to the Users section: a CSV export of user + all-time pick data, and a free-form broadcast notification sent to all users via existing channels (email, ntfy, Telegram, Discord).

---

## Part 1: CSV Export

### Backend

**New DB function** in `packages/backend/src/db/dbUserFunctions.ts`:
```
returnUserPickTotals(): Promise<{ userId, total, correct }[]>
```
Aggregates all-time picks across all years — same LEFT JOIN as `returnLeaderboard` but without the year filter. Returns `total` (non-voided picks), `correct` (winningTeam = teamChosen), `pending` (winningTeam = null). Excludes voided picks.

**New route** in `packages/backend/src/routes/admin.ts`:
```
GET /admin/users/export
```
- Middleware chain: `apiRateLimit`, `authMiddleware`, `requireRole('admin')`
- Calls `returnUsers()` + `returnUserPickTotals()` in parallel via `Promise.all`
- Merges by `userId`; computes `accuracy = correct / total` (0 if total = 0)
- Returns `c.json({ users: [...] })` with shape: `{ userId, displayName, email, roles, total, correct, accuracy }`

### Frontend

**New API function** in `packages/frontend/src/apis/adminRequests.ts`:
```
getAdminExport(): Promise<{ success, data?, error? }>
```
Uses Hono RPC client `client.api.admin.users.export.$get()`.

**CSV generation** in `UsersSection.tsx` (click handler):
- Calls `getAdminExport()`; on success builds CSV string from response
- Columns: `Display Name, Email, Roles, Total Picks, Correct Picks, Accuracy`
- Creates a `Blob`, sets `Content-Type: text/csv`, triggers download via temporary `<a>` tag
- Filename: `users-export-YYYY-MM-DD.csv` using `new Date().toISOString().slice(0, 10)`
- Button is disabled while `loading` (initial user load) or while export is in-flight (`exporting` state)

---

## Part 2: Admin Broadcast Notification

### Shared Types

`packages/shared/types/cfb-pickem-api.ts` — add `'admin_broadcast'` to the `NotificationType` union. No DB migration needed (`notification_type` column is `text()`).

### Backend

**New DB function** in `packages/backend/src/db/dbAdminFunctions.ts`:
```
resolveWeekContext(now: Date): Promise<{ year: number, weekNumber: number }>
```
1. Calls `returnCurrentWeek(now)` — if found, return `{ year, weekNumber }`
2. Else: query `MAX(year)` from `admin.weeks` — if found, return `{ year: maxYear + 1, weekNumber: 0 }`
3. Else: return `{ year: new Date().getFullYear(), weekNumber: 0 }`

**New function** in `packages/backend/src/notifications/dispatcher.ts`:
```
dispatchAdminBroadcast(subject, message, overrideEmailPreferences, year, weekNumber)
```
- If `overrideEmailPreferences=true`: fetch all users via `returnUsers()` and filter to `emailVerified=true`
- If false: fetch via `returnEmailOptedInUsers('admin_broadcast')` (all users default opted-in for this new type)
- Email channel: loops users, calls `sendEmail({ to, subject, htmlBody, textBody })` where both html and text body are the plain `message` string (no special template needed — it's admin-authored text), logs with `addNotificationLog(userId, year, weekNumber, 'admin_broadcast', 'email')`
- Broadcast channels (ntfy, Telegram, Discord): same pattern as existing dispatcher — send if enabled, log with `userId=0`
- No deduplication check before send (each broadcast is unique)

**New Zod validator** in `packages/backend/src/utils/zValidate.ts`:
```
adminBroadcastBodyValidator — z.object({ subject: z.string().min(1).max(100), message: z.string().min(1).max(1000), overrideEmailPreferences: z.boolean() })
```

**New route** in `packages/backend/src/routes/admin.ts`:
```
POST /admin/notifications/broadcast
```
- Middleware: `apiRateLimit`, `authMiddleware`, `requireRole('admin')`, `adminBroadcastBodyValidator`
- Calls `resolveWeekContext(getNow())` to get year/weekNumber
- Fires `dispatchAdminBroadcast(...)` — **await it** (unlike event-driven dispatches which fire-and-forget)
- Returns `c.json({ success: true })`

### Frontend

**New API function** in `packages/frontend/src/apis/adminRequests.ts`:
```
sendAdminBroadcast({ subject, message, overrideEmailPreferences }): Promise<{ success, error? }>
```

**Dialog state** added to `UsersSection.tsx`:
- `broadcastDialogOpen: boolean`
- `broadcastSubject: string`, `broadcastMessage: string`, `overrideEmailPrefs: boolean`
- `sending: boolean`, `broadcastError: string | null`, `broadcastSuccess: boolean`

**Dialog UI** (MUI `Dialog`) with:
- `TextField` for subject (required, max 100 chars shown with helper text)
- `TextField` multiline for message (required, max 1000 chars)
- `FormControlLabel` + `Checkbox` for "Override email preferences" (unchecked by default)
- Send button disabled while `sending`; shows `CircularProgress size={16}` while in-flight
- Success/error `Alert` rendered inside the dialog after submit
- Reset all state on dialog close

### NotificationLogSection

`packages/frontend/src/components/admin/NotificationLogSection.tsx` line 176:
Change `{entry.year} W{entry.weekNumber}` to:
```tsx
{entry.weekNumber === 0 ? `${entry.year} Pre-season` : `${entry.year} W${entry.weekNumber}`}
```
(If year is also 0, show `–` — edge case that shouldn't occur in practice but guard anyway.)

---

## Files Changed

| File | Change |
|------|--------|
| `packages/shared/types/cfb-pickem-api.ts` | Add `'admin_broadcast'` to `NotificationType` |
| `packages/backend/src/db/dbUserFunctions.ts` | Add `returnUserPickTotals()` |
| `packages/backend/src/db/dbAdminFunctions.ts` | Add `resolveWeekContext()` |
| `packages/backend/src/db/dbNotificationFunctions.ts` | No changes needed |
| `packages/backend/src/notifications/dispatcher.ts` | Add `dispatchAdminBroadcast()` |
| `packages/backend/src/utils/zValidate.ts` | Add `adminBroadcastBodyValidator` |
| `packages/backend/src/routes/admin.ts` | Add `GET /admin/users/export` and `POST /admin/notifications/broadcast` |
| `packages/frontend/src/apis/adminRequests.ts` | Add `getAdminExport()` and `sendAdminBroadcast()` |
| `packages/frontend/src/components/admin/UsersSection.tsx` | Export button + broadcast dialog |
| `packages/frontend/src/components/admin/NotificationLogSection.tsx` | Handle `weekNumber=0` display |

---

## Tests

**New route tests** (`packages/backend/tests/routes/`):
- `adminExport.test.ts`: 401 (no auth), 403 (non-admin), 200 (returns merged user+pick shape)
- `adminBroadcast.test.ts`: 401, 403, 400 (empty subject, empty message, subject over 100, message over 1000), 200 (spy on `dispatchAdminBroadcast` to verify called with correct args)

**New DB unit test** (`packages/backend/tests/db/`):
- `returnUserPickTotals`: seeded user with picks → correct totals; user with no picks → zeros

---

## Verification

1. `pnpm build` — no type errors
2. `pnpm test:backend` — all new route + DB tests pass
3. Manual: click Export CSV in admin Users tab → downloads valid CSV with correct pick counts
4. Manual: click Send Notification, fill subject + message, send → notification log shows new `admin_broadcast` entry with current week context
5. Manual (off-season simulation): no active week in DB → log entry shows `YYYY Pre-season`
