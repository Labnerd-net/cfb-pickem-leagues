# Plan: Admin Broadcast Notifications (League-Scoped and Platform-Wide)

## Context

The current admin broadcast sends to all users via email + site-wide ntfy/Telegram/Discord channels. As the app supports multiple leagues, these broadcast channels need to become per-league — each league admin configures their own community channels (Discord server, ntfy topic, Telegram group), and platform admin comms (email-only) are kept separate. This eliminates the awkward shared channel problem and gives league admins full control over their communication tools.

## Implementation Order

### Step 1 — Schema: Add `league_channels` table

**File:** `packages/backend/src/db/schema/leagues.ts`

Add a new `leagueChannels` table (one optional row per league):
```
leagueId (FK → leagues, PK)
ntfyTopicUrl (text, nullable)
telegramBotToken (text, nullable)
telegramChatId (text, nullable)
telegramInviteUrl (text, nullable)
discordWebhookUrl (text, nullable)
discordInviteUrl (text, nullable)
updatedAt (timestamp, defaultNow)
```

Run `pnpm generate && pnpm migrate` to apply.

Note: env var values cannot be migrated via SQL — admins configure channels through the UI after deploy.

---

### Step 2 — DB Functions

**File:** `packages/backend/src/db/dbLeagueFunctions.ts`

Add two functions following existing patterns:
- `getLeagueChannels(leagueId: number)` — returns the channel row or `undefined`
- `upsertLeagueChannels(leagueId: number, config: Partial<LeagueChannelConfig>)` — INSERT ... ON CONFLICT DO UPDATE

---

### Step 3 — Refactor Senders to Accept Config Params

**Files:** `ntfySender.ts`, `telegramSender.ts`, `discordSender.ts`

Change each sender function signature to accept the needed config directly instead of reading from env vars:
- `sendNtfyNotification({ topicUrl, title, message })` — remove `ntfyEnabled`/`ntfyTopicUrl` imports
- `sendTelegramNotification({ botToken, chatId, title, message })` — remove env var imports
- `sendDiscordNotification({ webhookUrl, title, message })` — remove env var imports

Each sender returns `false` (no-op) if its required config param is falsy.

---

### Step 4 — Update Dispatcher

**File:** `packages/backend/src/notifications/dispatcher.ts`

**`dispatchAdminBroadcast`** — remove the three broadcast channel blocks (ntfy/Telegram/Discord). Email only. Remove `ntfyEnabled`, `telegramEnabled`, `discordEnabled` imports.

**Add `dispatchLeagueBroadcast(leagueId, leagueName, subject, message, overrideEmailPreferences, year, weekNumber)`**:
1. Fetch league members for email (same pattern as `dispatchNotification` email block, scoped to `leagueId`)
2. Send per-user email using `adminBroadcastTemplate` with league name in subject (reuse or extend `adminBroadcastTemplate` to accept optional `leagueName`)
3. Fetch league channel config via `getLeagueChannels(leagueId)` 
4. Send to ntfy/Telegram/Discord if configured — pass config directly to updated senders
5. Log each send to `notification_log` with the `leagueId`

**`dispatchNotification`** — already uses league-scoped broadcast channels via env vars. Update to fetch league channel config from DB instead, passing config to senders. Remove env var imports.

---

### Step 5 — Update Shared Types

**File:** `packages/shared/types/cfb-pickem-api.ts`

Add:
```ts
export interface LeagueChannelConfig {
  ntfyTopicUrl: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  telegramInviteUrl: string | null;
  discordWebhookUrl: string | null;
  discordInviteUrl: string | null;
}

export interface LeagueChannelInfo {
  ntfy: { topicUrl: string } | null;
  telegram: { inviteUrl: string | null } | null;
  discord: { inviteUrl: string | null } | null;
}
```

`LeagueChannelConfig` is the admin-facing full config (includes tokens/webhooks).
`LeagueChannelInfo` is the public-facing info (invite URLs only — same shape as current `BroadcastChannelInfo`).

Update `BroadcastChannelInfo` → alias or replace with `LeagueChannelInfo` for the `GET /user/notifications/channels` response.

---

### Step 6 — New and Updated API Endpoints

**File:** `packages/backend/src/routes/leagues.ts`

Add three routes (after existing routes, before `export default`):

**`GET /:leagueId/channels`** — requires `requireLeagueMembership('admin')`:
- Returns `LeagueChannelConfig` (full config including tokens — admin only)

**`PATCH /:leagueId/channels`** — requires `requireLeagueMembership('admin')`:
- Body: all `LeagueChannelConfig` fields (all optional)
- Calls `upsertLeagueChannels(leagueId, body)`
- Returns updated config

**`POST /:leagueId/broadcast`** — requires `requireLeagueMembership('admin')`:
- Body: `{ subject: string, message: string, overrideEmailPreferences: boolean }`
- Resolves week context via `resolveWeekContext` (import from dbAdminFunctions)
- Wraps `dispatchLeagueBroadcast(...)` in `c.executionCtx.waitUntil()`
- Returns `{ success: true }`

Add validators to `zValidate.ts` for channel config body and broadcast body (reuse existing `adminBroadcastBodyValidator` pattern).

**File:** `packages/backend/src/routes/user.ts`

Update `GET /notifications/channels` to accept optional `?leagueId=` query param:
- If `leagueId` provided: fetch `getLeagueChannels(leagueId)` and return `LeagueChannelInfo` (public fields only — no tokens/webhooks)
- If no `leagueId`: return `{ ntfy: null, telegram: null, discord: null }` (platform has no channels post-migration)

---

### Step 7 — Remove Broadcast Channel Env Vars

**File:** `packages/backend/src/utils/envVars.ts`

Remove from schema, parsed env, module-level exports, and `reinitializeSecrets()`:
- `NTFY_TOPIC_URL` / `ntfyTopicUrl` / `ntfyEnabled`
- `TELEGRAM_BOT_TOKEN` / `telegramBotToken`, `TELEGRAM_CHAT_ID` / `telegramChatId`, `TELEGRAM_INVITE_URL` / `telegramInviteUrl`, `telegramEnabled`
- `DISCORD_WEBHOOK_URL` / `discordWebhookUrl`, `DISCORD_INVITE_URL` / `discordInviteUrl`, `discordEnabled`

Also remove from `CLAUDE.md` env var reference section.

---

### Step 8 — Frontend: League Channel Config Form

**File:** `packages/frontend/src/components/LeagueSettingsSection.tsx`

Add a new "Notification Channels" section (after member management, league admin only):
- Fetch existing config on open via `GET /api/leagues/:leagueId/channels`
- Form fields: ntfy topic URL, Telegram bot token, Telegram chat ID, Telegram invite URL, Discord webhook URL, Discord invite URL
- Save via `PATCH /api/leagues/:leagueId/channels`
- Success/error snackbar (existing pattern)

Add API functions to `leagueRequests.ts`:
- `getLeagueChannels(leagueId)` — GET
- `updateLeagueChannels(leagueId, config)` — PATCH

---

### Step 9 — Frontend: League Broadcast Form

**File:** `packages/frontend/src/components/admin/LeagueAdminSection.tsx`

Add a "Send Message to League" `DashboardCard` (new card in the grid, after existing game management card):
- Subject field, message textarea, override preferences checkbox
- Submit via `POST /api/leagues/:leagueId/broadcast`
- Success/error snackbar (existing pattern)
- Reuse `BroadcastDialog` component pattern from `UsersSection` if applicable

Add `sendLeagueBroadcast(leagueId, body)` to `adminRequests.ts`.

---

### Step 10 — Frontend: Update Settings Page Channel Display

**File:** `packages/frontend/src/pages/Settings.tsx`

Update `getBroadcastChannels()` call (or replace) to fetch `GET /user/notifications/channels?leagueId=<activeLeagueId>`:
- Show per-league channel info (ntfy subscribe link, Telegram invite, Discord invite)
- If active league has no channels configured, show nothing or a "No channels configured" note
- Remove any assumption that channels are platform-level

Update `leagueRequests.ts` or `userRequests.ts` accordingly. Update `BroadcastChannelInfo` usage to `LeagueChannelInfo`.

---

### Step 11 — Frontend: Update Platform Admin Broadcast UI

**File:** `packages/frontend/src/components/BroadcastDialog.tsx` (used in `UsersSection.tsx`)

Remove any mention of ntfy/Telegram/Discord from the platform broadcast UI — it's email only now. Update helper text/description to say "email only."

---

### Step 12 — Tests

**New test file:** `packages/backend/tests/routes/leagueBroadcast.test.ts`
- 403 when caller has `LeagueRole = 'member'`
- 403 when caller has no membership
- 200 for league admin — verify `dispatchLeagueBroadcast` called with correct leagueId
- Mock `dispatchLeagueBroadcast` (same pattern as `adminBroadcast.test.ts`)

**New test file:** `packages/backend/tests/routes/leagueChannels.test.ts`  
- GET returns 403 for non-admin
- GET returns channel config for league admin
- PATCH updates config, GET returns updated values

Update `adminBroadcast.test.ts`: verify ntfy/Telegram/Discord mocks are NOT called after platform broadcast (email only).

---

## Verification

1. `pnpm build` — no type errors
2. `pnpm test` — all tests pass
3. Manual: deploy, set channel config via League Settings UI for a league, trigger league broadcast, verify email + Discord/ntfy/Telegram receive it
4. Manual: trigger platform admin broadcast, verify only email is sent (Resend dashboard)
5. Manual: Settings page shows correct per-league channels for active league
