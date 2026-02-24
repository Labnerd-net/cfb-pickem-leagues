# Plan: Notification System

## Context
Add email (SES) and NTFY notification support to the CFB Pick'em app. Three notification types: games ready to pick (event-driven from admin route), picks deadline reminder (cron-scheduled 1hr before first kickoff), and rankings updated (automated after score refresh detects all games complete). All scheduling lives inside the Hono process. A Postgres notification log table handles deduplication. No Redis required.

---

## Phase 1 — DB Schema

**File: `packages/backend/src/db/schema/users.ts`**
- Add `boolean` to the `drizzle-orm/pg-core` imports (currently missing)
- Add 4 columns to `users` table: `emailVerified boolean default false`, `emailVerificationToken text nullable`, `emailVerificationSentAt timestamp nullable`, `ntfyServerUrl text nullable`
- Add new table `notificationPreferences`: composite PK on `(userId, notificationType, channel)`, FK to `users.userId` on delete cascade, `enabled boolean default true`
- Add new table `notificationLog`: serial PK, `(userId, year, weekNumber, notificationType, channel, sentAt)`, unique constraint on `(userId, year, weekNumber, notificationType, channel)`, FK to `users.userId` on delete cascade

**Action:** Run `pnpm generate` then `pnpm migrate` (dev) and `NODE_ENV=test pnpm migrate` (test DB).

---

## Phase 2 — Test Setup

**File: `packages/backend/tests/setup.ts`**
- In the `client.exec()` SQL block, add `ALTER TABLE "user".users ADD COLUMN ...` for the 4 new user columns
- Add `CREATE TABLE "user".notification_preferences (...)` matching the production schema
- Add `CREATE TABLE "user".notification_log (...)` with the unique constraint

**File: `packages/backend/tests/db-utils.ts`**
- Add `TRUNCATE "user".notification_log, "user".notification_preferences CASCADE` to `cleanDatabase()` (before truncating users)
- Add helpers: `createTestNotificationPreference(userId, notificationType, channel, enabled)` and `createTestNotificationLog(userId, year, weekNumber, notificationType, channel)`

---

## Phase 3 — Shared Types

**File: `packages/shared/types/cfb-pickem-api.ts`**
- Add `NotificationType = 'games_ready' | 'picks_reminder' | 'rankings_updated'`
- Add `NotificationChannel = 'email' | 'ntfy'`
- Add `NotificationPreference { userId, notificationType, channel, enabled }`
- Add `NotificationSettings { preferences: NotificationPreference[], ntfyServerUrl: string | null, emailVerified: boolean }`
- Extend `ProfileData` to include `emailVerified: boolean` (needed by the frontend to show verification status)

---

## Phase 4 — Backend Notification Infrastructure

**Action:** Install in `packages/backend`: `@aws-sdk/client-ses`, `node-cron`

**File: `packages/backend/src/utils/envVars.ts`**
- Add exports: `notificationFromEmail` (`process.env.NOTIFICATION_FROM_EMAIL || ''`), `awsRegion` (`process.env.AWS_REGION || 'us-east-1'`), `notificationsEnabled` (boolean, true when `NOTIFICATION_FROM_EMAIL` is set)
- Add `SKIP_EMAIL_SEND` env var support: `export const skipEmailSend = process.env.SKIP_EMAIL_SEND === 'true'` — allows bypassing SES in dev (SES sandbox only allows pre-verified addresses)
- Do not throw on missing SES vars — log a warning instead

**File: `packages/backend/src/notifications/emailSender.ts`** (new)
- Export `sendEmail({ to, subject, htmlBody, textBody })` using `@aws-sdk/client-ses` `SESClient` + `SendEmailCommand`
- Sender: `"CFB Pick'em" <${notificationFromEmail}>`
- Return early (with warning log) if `!notificationsEnabled || skipEmailSend`
- Returns `boolean` success; does not throw

**File: `packages/backend/src/notifications/ntfySender.ts`** (new)
- Export `sendNtfyNotification({ ntfyServerUrl, userId, title, message })`
- Derives topic as `cfb-pickem-${userId}`; POSTs to `${ntfyServerUrl}/${topic}` with `Title` header
- Uses native `fetch`; returns `boolean`; does not throw

**File: `packages/backend/src/notifications/templates.ts`** (new)
- Export `gamesReadyTemplate({ year, weekNumber })`, `picksReminderTemplate({ year, weekNumber, firstKickoffTime })`, `rankingsUpdatedTemplate({ year, weekNumber })` — each returns `{ subject, htmlBody, textBody }`
- Simple inline HTML; no external template engine

**File: `packages/backend/src/db/dbNotificationFunctions.ts`** (new)

Functions (follow existing naming conventions and error/logging patterns):
- `returnNotificationPreferences(userId)` — all preference rows for a user
- `returnNotificationSettings(userId)` — returns `NotificationSettings` (joins with users for `ntfyServerUrl`, `emailVerified`)
- `upsertNotificationPreference(userId, notificationType, channel, enabled)` — `onConflictDoUpdate` on composite PK
- `returnOptedInUsers(notificationType, channel)` — users opted in to a type+channel; joins `users` for `email`, `ntfyServerUrl`, `emailVerified`, `userId`. Includes users with no preference rows (treated as opted-in by default)
- `addNotificationLog(userId, year, weekNumber, notificationType, channel)` — `onConflictDoNothing()`
- `hasNotificationBeenSent(userId, year, weekNumber, notificationType, channel)` — returns boolean
- `updateUserNtfyUrl(userId, ntfyServerUrl)` — updates `ntfy_server_url` on users table
- `setEmailVerificationToken(userId, token, sentAt)` — updates token + sentAt
- `markEmailVerified(token)` — finds user by token, sets `emailVerified = true`, clears token; returns user or null

**File: `packages/backend/src/notifications/dispatcher.ts`** (new)
- Export `dispatchNotification({ notificationType, year, weekNumber })`
- For each channel ('email', 'ntfy'): query `returnOptedInUsers()`, for each user check `hasNotificationBeenSent()`, apply channel eligibility (email: must be verified and have email; ntfy: must have `ntfyServerUrl`), send via the appropriate sender, on success call `addNotificationLog()`
- Never throws; logs individual failures and continues to next user

---

## Phase 5 — Cron Scheduler

**File: `packages/backend/src/cron/cronLogic.ts`** (new) — pure functions, no IO:
- `shouldSendPicksReminder({ now, firstKickoff })` → true if `now` is in window `[firstKickoff - 75min, firstKickoff - 60min]`
- `shouldRefreshScores({ now, lastKickoff, lastRefreshAt, hardCapStart })` → true if `now >= lastKickoff` AND `now - lastRefreshAt >= 60min` AND `now - hardCapStart < 12hr`
- `isWeekComplete(games)` → true if array non-empty and all have `completed = true`
- `getFirstKickoff(games)` / `getLastKickoff(games)` → min/max `startTime`, or null

**File: `packages/backend/src/db/dbAdminFunctions.ts`** (modify) — add:
- `returnCurrentWeek(today: Date)` — queries `adminWeeks` for `weekStart <= today <= weekEnd`; returns `AdminWeekData | null`

**File: `packages/backend/src/db/dbUserFunctions.ts`** (modify) — add:
- `returnUserPickCount(userId, year, weekNumber)` — counts rows in `user.games` joined to `admin.games` for the week (used by picks reminder to check picks < total)

**File: `packages/backend/src/cron/cronTick.ts`** (new)
- Module-level in-memory state: `lastRefreshAt`, `hardCapStart`, `scoresCompletedForWeek` (prevents re-firing `rankings_updated` after restart detection already handled by notification log)
- Export `runCronTick()` which:
  1. Gets current week via `returnCurrentWeek(today)` — returns if none
  2. Gets picked games via `returnPickedGames({ year, week })`
  3. **Picks reminder**: computes `firstKickoff`, calls `shouldSendPicksReminder()`, if true calls `dispatchNotification('picks_reminder', ...)` — dispatcher handles per-user log deduplication
  4. **Score refresh**: computes `lastKickoff`, calls `shouldRefreshScores()`, if true: calls `getGameData()` + `upsertGameForWeek()` for each game (reuse existing pattern from `POST /admin/week` route), updates `lastRefreshAt`, re-fetches games from DB, if `isWeekComplete()` and not already fired this week → calls `dispatchNotification('rankings_updated', ...)`
- Sets `hardCapStart` on first detection of a new week where `lastKickoff` is in the past

**File: `packages/backend/src/index.ts`** (modify)
- Import `node-cron` and `runCronTick`
- Inside the `serve()` callback, after the `pinoLogger.info(...)` call, schedule: `cron.schedule('*/15 * * * *', () => { runCronTick().catch(err => pinoLogger.error(err, 'cron tick failed')) })`
- Add `'PUT'` to the CORS `allowMethods` array (needed for `PUT /notifications/preferences`)

---

## Phase 6 — Backend Route Changes

**File: `packages/backend/src/routes/auth.ts`** (modify)
- In the registration handler, after `addUser()` succeeds: generate token via `crypto.randomBytes(32).toString('hex')`, call `setEmailVerificationToken()`, fire `sendEmail()` with verification link (fire-and-forget with `.catch()`)
- Add `GET /verify-email` (public): reads `?token` query param (add `zValidator('query', ...)` for typed RPC client compatibility), calls `markEmailVerified(token)`, returns `{ status: 'verified' }` or 400
- Add `POST /resend-verification` (protected by `authMiddleware`): generates new token, calls `setEmailVerificationToken()`, fires verification email; rate-limit with `authRateLimit`

**File: `packages/backend/src/routes/admin.ts`** (modify)
- In `POST /week` handler, after the `upsertGameForWeek` calls succeed: fire `dispatchNotification({ notificationType: 'games_ready', year, weekNumber })` as background promise with `.catch()` — do not block the route response

**File: `packages/backend/src/routes/user.ts`** (modify) — add 4 endpoints:
- `GET /notifications/preferences` — calls `returnNotificationSettings(userId)`, returns `NotificationSettings`
- `PATCH /notifications/preferences` — validated by `notificationPreferenceValidator`, calls `upsertNotificationPreference()`
- `PATCH /notifications/ntfy-url` — validated by `ntfyUrlValidator`, calls `updateUserNtfyUrl()`
- `POST /notifications/test-ntfy` — fetches user's `ntfyServerUrl`, returns 400 if missing, calls `sendNtfyNotification()`, returns `{ status: 'sent' | 'failed' }`

**File: `packages/backend/src/utils/zValidate.ts`** (modify)
- Add `notificationPreferenceValidator`: validates `{ notificationType: z.enum([...]), channel: z.enum(['email', 'ntfy']), enabled: z.boolean() }`
- Add `ntfyUrlValidator`: validates `{ ntfyServerUrl: z.string().url().nullable() }`
- Add query validator for verify-email: `{ token: z.string().min(1) }`

---

## Phase 7 — Frontend

**File: `packages/frontend/src/apis/authRequests.ts`** (modify)
- Add `verifyEmailToken(token: string)` — GET `/api/auth/verify-email?token=...`
- Add `resendVerificationEmail()` — POST `/api/auth/resend-verification`

**File: `packages/frontend/src/apis/userRequests.ts`** (modify)
- Add `getNotificationSettings()`, `updateNotificationPreference(pref)`, `updateNtfyUrl(url)`, `sendTestNtfy()`

**File: `packages/frontend/src/pages/Settings.tsx`** (new)
- Three sections:
  1. **Account**: shows email + verified badge or "Unverified — Resend email" button; calls `resendVerificationEmail()`
  2. **NTFY**: URL text field with Zod URL validation, Save button (`updateNtfyUrl`), Test button (`sendTestNtfy`) with inline success/fail feedback
  3. **Notification Preferences**: grid of all 3 types × 2 channels as checkboxes; pre-populated from `getNotificationSettings()`; each toggle calls `updateNotificationPreference()` immediately; disabled with tooltip if channel not usable (email not verified / no NTFY URL)
- Follow existing form patterns: React Hook Form + Zod, `mode: 'onBlur'`, MUI `TextField`/`Button`/`Stack`

**File: `packages/frontend/src/pages/VerifyEmail.tsx`** (new)
- Reads `?token` via `useSearchParams()`; on mount calls `verifyEmailToken(token)`; shows loading → success (link to dashboard) or error (link to settings to resend)

**File: `packages/frontend/src/App.tsx`** (modify)
- Add protected route `settings` → `<PrivateRoute><Settings /></PrivateRoute>`
- Add public route `verify-email` → `<VerifyEmail />` (before the catch-all `*`)

**File: `packages/frontend/src/components/navbar/Navbar.tsx`** (modify)
- Add Settings link/icon button (visible when authenticated) navigating to `/settings`

**File: `packages/frontend/tests/mocks/handlers.ts`** (modify)
- Add MSW handlers for all new endpoints

---

## Phase 8 — Tests

**`packages/backend/tests/unit/db/notificationFunctions.test.ts`** (new)
- `upsertNotificationPreference`: create then update (idempotent)
- `addNotificationLog` + `hasNotificationBeenSent`: after add returns true; conflict does not error
- `markEmailVerified`: valid token → verified + cleared; invalid token → null
- `updateUserNtfyUrl`: updates field correctly

**`packages/backend/tests/unit/cronLogic.test.ts`** (new) — pure function tests, no mocks:
- `shouldSendPicksReminder`: inside window, outside window, at boundaries, null kickoff
- `shouldRefreshScores`: too soon (throttle), past 12hr cap, before last kickoff, valid window
- `isWeekComplete`: all complete, one incomplete, empty array
- `getFirstKickoff` / `getLastKickoff`: min/max extraction, null handling

**`packages/backend/tests/unit/notifications.test.ts`** (new)
- Mock `@aws-sdk/client-ses` with `vi.mock()`; verify `sendEmail` calls `SendEmailCommand` correctly; verify it skips when `skipEmailSend = true`
- Stub `fetch` with `vi.stubGlobal`; verify `sendNtfyNotification` POSTs to correct URL; returns false on network error

**`packages/backend/tests/routes/notifications.test.ts`** (new)
- Mount `userRoutes` and `authRoutes` on a Hono test app
- Mock `emailSender` and `ntfySender` with `vi.mock()`
- Test: preferences GET/PATCH, ntfy-url PATCH (valid/invalid), test-ntfy POST (no URL → 400, URL set → 200), verify-email GET (valid token → 200, bad token → 400), resend-verification POST (authed → 200, no auth → 401)

**`packages/frontend/tests/unit/apis/notificationRequests.test.ts`** (new)
- MSW-based tests for all 5 new API functions: 200 → `{ success: true, data }`, 4xx → `{ success: false, error }`

---

## New Environment Variables

```
NOTIFICATION_FROM_EMAIL=   # SES sender address
AWS_ACCESS_KEY_ID=         # SES credentials
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
SKIP_EMAIL_SEND=true       # set in dev to bypass SES sandbox
```

---

## Verification

1. Run `pnpm test:backend` — all tests pass including new notification tests
2. Run `pnpm test:frontend` — new MSW API tests pass
3. Start backend + frontend locally
4. Register a new user — check logs show verification email attempted (or token logged if `SKIP_EMAIL_SEND=true`)
5. Visit `/settings` — verify all three sections render with correct initial state
6. Save a NTFY URL and click "Send test notification" — verify POST arrives at NTFY server
7. As admin, import games for a week — verify `games_ready` notification dispatched (check logs)
8. Run `pnpm test:coverage` and confirm new code has reasonable coverage
