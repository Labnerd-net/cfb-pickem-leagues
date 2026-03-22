# Plan: Backlog Fixes — Timezone, Tab Indices, Env Validation, Log Pagination

## Context

Four low-priority backlog items grouped into one branch. Three are trivial ([30], [31], [33]); one requires a backend + frontend change ([28]).

---

## [30] Email Timezone Fix

**File:** `packages/backend/src/notifications/templates.ts:39`

**Change:** Add `timeZone: 'America/Chicago'` to the existing `toLocaleString` options object in `picksReminderTemplate`. The `timeZoneName: 'short'` option is already there so the output will show `CDT`/`CST` automatically.

```diff
- const kickoffStr = firstKickoffTime.toLocaleString('en-US', {
+ const kickoffStr = firstKickoffTime.toLocaleString('en-US', {
+   timeZone: 'America/Chicago',
    weekday: 'short',
    ...
```

One-line change.

**Test:** Unit test in `packages/backend/tests/` — given a `Date` in a known UTC offset, verify the formatted string contains `CT`/`CDT`/`CST` and not a server-local timezone abbrev.

---

## [31] Dashboard Tab Refactor

**File:** `packages/frontend/src/pages/Dashboard.tsx:68-78`

**Change:** Replace the ternary chain with an array of `{ component }` objects, indexed by `currentTab`. The Dev Tools tab is conditional on `IS_DEV`, so build the array with a conditional push or filter.

```ts
const tabs = [
  { component: <UserSection /> },
  { component: <AdminSection /> },
  { component: <UsersSection /> },
  { component: <NotificationLogSection /> },
  ...(IS_DEV ? [{ component: <DevSection /> }] : []),
];

// Render:
{tabs[currentTab]?.component}
```

No behavior change — same 5 tabs (4 always + 1 conditionally), same order.

**No test needed** — pure structural refactor with no logic.

---

## [33] Env Var Startup Validation

**File:** `packages/backend/src/utils/envVars.ts`

**Current state:** `JWT_SECRET` and `DATA_SOURCE` are already validated with throws. `CFBD_API_KEY` is conditionally validated. Everything else uses `|| ''` / `|| default` with no validation.

**Change:** Replace the manual imperative checks with a single Zod schema parse at the top of the file. Export values from the parsed result.

Key schema rules:
- `JWT_SECRET`: `z.string().min(1)` — required
- `DATA_SOURCE`: `z.enum(['ncaa', 'cfbd']).default('ncaa')` — enum, required with default
- `CFBD_API_KEY`: `z.string().optional()` — validated conditionally via `.superRefine()` (must be present when `DATA_SOURCE=cfbd`)
- `SERVER_PORT`: `z.coerce.number().default(3000)`
- `JWT_ALGORITHM`: `z.string().default('HS256')`
- `JWT_EXPIRATION_DAYS`: `z.coerce.number().default(7)`
- `JWT_SALT_ROUNDS`: `z.coerce.number().default(10)`
- `LOG_LEVEL`: `z.string().default('info')`
- `SMTP_PORT`: `z.coerce.number().default(587)` — catches `SMTP_PORT=abc` at startup
- All others: `z.string().default('')` or `z.string().optional()`

DB vars (`DB_USER`, `DB_HOST`, etc.) are read in `db/index.ts` not `envVars.ts` — leave them in place; scope this fix to `envVars.ts` only.

The file currently has no Zod import — add it. Keep the exported variable names identical so no other files need changes.

**Test:** Unit tests in `packages/backend/tests/` for the validation function/schema:
- Missing `JWT_SECRET` → throws
- Valid minimal config → passes
- `DATA_SOURCE=cfbd` without `CFBD_API_KEY` → throws
- `DATA_SOURCE=ncaa` without `CFBD_API_KEY` → passes

Because the schema is module-level code, tests should import and call a validation helper function rather than importing the module directly (to avoid side effects). Expose a `validateEnv(env: NodeJS.ProcessEnv)` function that runs the parse and export the result. The module-level code calls it with `process.env`.

---

## [28] Notification Log Pagination

### Backend

**File:** `packages/backend/src/db/dbNotificationFunctions.ts:225`

Add `offset: number` parameter to `returnNotificationLogs(limit, offset)`. Add `.offset(offset)` to the Drizzle query.

**File:** `packages/backend/src/routes/admin.ts:159`

Add inline `zValidator('query', ...)` to the `GET /notification-logs` route:
```ts
const notificationLogQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(50),
  offset: z.coerce.number().min(0).default(0),
});
```
Pass `limit` and `offset` to `returnNotificationLogs`. Keep the 500 safety ceiling. Add a comment: `// Hard cap: 500 rows max. Sufficient for ~1–2 seasons at this scale.`

### Frontend

**File:** `packages/frontend/src/apis/adminRequests.ts`

Update `getNotificationLogs()` to accept optional `{ limit, offset }` params and pass them as query params to the RPC client call.

**File:** `packages/frontend/src/components/admin/NotificationLogSection.tsx`

Add `page` state (0-indexed). Replace the "Showing X of Y" text with Previous/Next buttons:
- Show current page and total pages
- Previous disabled on page 0; Next disabled when `(page + 1) * PAGE_SIZE >= total`
- Changing page resets to top of list (or just re-fetches; depends on scroll behavior)
- `PAGE_SIZE = 50` constant
- Client-side channel/type filters remain, applied to the current page's entries

Note: filters still operate on the current page only. This is acceptable — at target scale (15-20 users, 1 season), filters will almost always show everything on page 1.

**Test:**
- Backend: route test — `GET /notification-logs?limit=2&offset=0` returns 2 entries; `?offset=9999` returns empty array; missing params uses defaults.

---

## Implementation Order

1. [30] timezone fix (1 line + test)
2. [31] tab refactor (frontend only, no test)
3. [33] env var Zod refactor (backend, tests)
4. [28] pagination (backend DB + route + frontend, tests)

## Verification

- `pnpm build` passes
- `pnpm test:backend` passes (new tests for [30], [33], [28] backend)
- `pnpm test:frontend` passes
- Manual: load Notification Log tab in browser, verify Previous/Next buttons work
- Manual: send a picks reminder in dev and verify email shows Central time
