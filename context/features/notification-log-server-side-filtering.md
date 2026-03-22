# Plan: Notification Log Server-Side Filtering

## Context

`GET /admin/notification-logs` accepts only `limit` and `offset`. Channel and notification-type filters exist only on the frontend — applied client-side after fetch. As a result, the `total` count and pagination both reflect the unfiltered DB total, which is wrong whenever a filter is active. Fix: add optional `channel` and `notificationType` query params to the backend route and DB function so the count and pagination always reflect what's actually shown.

---

## Files to Modify

1. `packages/backend/src/db/dbNotificationFunctions.ts`
2. `packages/backend/src/routes/admin.ts`
3. `packages/frontend/src/apis/adminRequests.ts`
4. `packages/frontend/src/components/admin/NotificationLogSection.tsx`
5. `packages/backend/tests/routes/adminNotificationLogs.test.ts`
6. `packages/backend/tests/unit/db/notificationFunctions.test.ts`

---

## Implementation Steps

### 1. DB Function — `returnNotificationLogs` (dbNotificationFunctions.ts:225)

Add optional `channel` and `notificationType` params. Build a WHERE clause conditionally using Drizzle's `and()` and `eq()`, then apply it to both the rows query and the count query.

```typescript
export async function returnNotificationLogs(
  limit: number,
  offset: number,
  channel?: string,
  notificationType?: string
): Promise<{ entries: NotificationLogEntry[]; total: number }>
```

- Build `whereClause`:
  ```typescript
  const conditions = [];
  if (channel) conditions.push(eq(notificationLog.channel, channel));
  if (notificationType) conditions.push(eq(notificationLog.notificationType, notificationType));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  ```
- Apply `.where(whereClause)` to both the main rows query and the count query in `Promise.all`.
- No other changes to the function body.
- Imports needed: `and` is already imported; `eq` is already imported — confirm both are in scope.

### 2. Admin Route (admin.ts:163)

Extend the Zod query schema with two optional enum fields:

```typescript
z.object({
  limit: z.coerce.number().min(1).max(500).default(50),
  offset: z.coerce.number().min(0).default(0),
  channel: z.enum(['email', 'ntfy', 'telegram', 'discord']).optional(),
  notificationType: z.enum(['games_ready', 'picks_reminder', 'rankings_updated']).optional(),
})
```

Destructure the new fields and pass them to `returnNotificationLogs`:

```typescript
const { limit, offset, channel, notificationType } = c.req.valid('query');
const { entries, total } = await returnNotificationLogs(limit, offset, channel, notificationType);
```

### 3. Frontend API — `getNotificationLogs` (adminRequests.ts:176)

Add `channel` and `notificationType` optional params and pass them to the RPC client query:

```typescript
export async function getNotificationLogs(
  params: { limit?: number; offset?: number; channel?: NotificationChannel; notificationType?: NotificationType } = {}
): Promise<GetNotificationLogsResponse>
```

Add to the query object:
```typescript
channel: params.channel ?? undefined,
notificationType: params.notificationType ?? undefined,
```

Import `NotificationChannel` and `NotificationType` from `@shared/types/cfb-pickem-api` if not already imported.

### 4. Component — `NotificationLogSection` (NotificationLogSection.tsx)

- Pass filter state to `getNotificationLogs` inside the `useEffect`:
  ```typescript
  const result = await getNotificationLogs({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    channel: channelFilter || undefined,
    notificationType: typeFilter || undefined,
  });
  ```
- Add `channelFilter` and `typeFilter` to the `useEffect` dependency array (currently only `[refreshKey, page]`).
- Remove the `filtered` array (lines 66-70). Replace all references to `filtered` in JSX with `entries`.
- The empty-state check `entries.length === 0` still works correctly — no change needed there.

---

## Tests

### Route tests (adminNotificationLogs.test.ts)

Add to existing test file:
- `channel=email` filter: seeded logs include both email and ntfy entries; response should contain only email entries and `total` should reflect only email count.
- `notificationType=games_ready` filter: response contains only `games_ready` entries with matching total.
- Both filters combined: AND behavior — response entries match both conditions.
- Invalid `channel` value (e.g. `channel=invalid`) returns 400.
- Invalid `notificationType` value returns 400.

### DB function tests (notificationFunctions.test.ts)

Add tests using `createTestNotificationLog()` to seed varied data:
- Call `returnNotificationLogs` with `channel='email'` — verify returned entries all have `channel==='email'` and `total` equals only the seeded email count.
- Call with `notificationType='games_ready'` — same pattern.
- Call with both filters — verify AND behavior and total.
- Call with no filters — existing behavior unchanged, all entries returned.

---

## Verification

1. `pnpm build` passes (TypeScript, no errors).
2. `pnpm test:backend` passes — existing + new tests green.
3. Manual: open notification log in admin panel, apply channel filter, confirm count and pagination match visible rows.
