# Plan: Broadcast Notifications — Telegram, Discord, and ntfy Refactor

Spec: `_specs/telegram-discord-notifications.md`

## Architecture decision

Broadcast channels (ntfy, Telegram, Discord) are admin-configured via env vars; the backend sends once per event. Per-user configuration for these channels is removed.

Email remains per-user (individual addresses required) and retains per-notification-type opt-outs. Users control their own subscription on broadcast channels by leaving/muting the ntfy topic, Discord channel, or Telegram group.

- **Email**: sent to all verified users who have not opted out of that notification type.
- **ntfy**: admin configures one topic URL; backend POSTs once per event.
- **Telegram**: admin configures bot token + group/channel chat ID; backend sends once per event.
- **Discord**: admin configures one webhook URL; backend POSTs once per event.

---

## Step 1 — Database migrations (`packages/backend/src/db/schema/users.ts`)

**Remove** the `ntfy_server_url` column from the `users` table — it is no longer used.

The `notification_preferences` table **stays**, but is now email-only. Existing rows for `ntfy` channel can be ignored by the dispatcher; a follow-up migration to clean them up is optional.

The `notification_log` table stays for deduplication. For broadcast channels (ntfy, Telegram, Discord), use `userId = 0` as a sentinel value. This reuses the existing unique constraint `(userId, year, weekNumber, notificationType, channel)` to prevent duplicate broadcasts.

Run `pnpm generate` then `pnpm migrate` to apply.

---

## Step 2 — Shared types (`packages/shared/types/cfb-pickem-api.ts`)

- Add `"telegram"` and `"discord"` to the `NotificationChannel` union.
- Remove `ntfyServerUrl` from `NotificationSettings` and `UserDbData`.
- `NotificationSettings.preferences` stays — it now only reflects email preferences.
- `NotificationChannel` stays (still used by the notification log and email preferences).

---

## Step 3 — Environment variables (`packages/backend/src/utils/envVars.ts`)

Add the following, following the existing pattern of empty-string defaults and a derived enabled flag:

```
NTFY_TOPIC_URL          # full ntfy URL including topic, e.g. https://ntfy.sh/cfb-pickem
TELEGRAM_BOT_TOKEN      # bot token from BotFather
TELEGRAM_CHAT_ID        # group or channel chat ID the bot will post to
DISCORD_WEBHOOK_URL     # Discord channel webhook URL
```

- `ntfyEnabled`: `ntfyTopicUrl !== ''`
- `telegramEnabled`: `telegramBotToken !== '' && telegramChatId !== ''`
- `discordEnabled`: `discordWebhookUrl !== ''`

Document all four in `CLAUDE.md` under Environment Variables.

---

## Step 4 — Update `ntfySender.ts`

The existing sender is built around a per-user URL. Simplify it:

- Remove the `userId` parameter — it is no longer needed for topic construction.
- Accept `{ title: string, message: string }` only.
- Read `ntfyTopicUrl` from env vars directly inside the module (same pattern as `emailSender.ts` reading SMTP config).
- Remove URL parsing logic for user-supplied credentials — the admin-configured URL handles auth if needed (the existing credential-parsing code can stay as a convenience but the URL now comes from env, not user input).

---

## Step 5 — New sender modules (`packages/backend/src/notifications/`)

### `telegramSender.ts`
- Accepts `{ title: string, message: string }`.
- Reads `telegramBotToken` and `telegramChatId` from env vars.
- POSTs to `https://api.telegram.org/bot{TOKEN}/sendMessage` with `chat_id`, `text` formatted as `*{title}*\n{message}`, and `parse_mode: 'Markdown'`.
- Returns `false` and logs on non-OK response or network error.

### `discordSender.ts`
- Accepts `{ title: string, message: string }`.
- Reads `discordWebhookUrl` from env vars.
- POSTs to the webhook URL with `{ content: "**{title}**\n{message}" }` as JSON.
- Returns `false` and logs on non-OK response or network error.

---

## Step 6 — DB functions (`packages/backend/src/db/dbNotificationFunctions.ts`)

- **Remove** `updateUserNtfyUrl` — no longer needed.
- **Update** `returnOptedInUsers` to only query `email` channel preferences. Remove the `ntfyServerUrl` select and return. Rename to `returnEmailOptedInUsers` for clarity.
- **Update** `hasNotificationBeenSent` / `addNotificationLog` to support `userId = 0` as the broadcast sentinel for non-email channels.
- `getUserNotificationSettings` stays and continues to serve the Settings page; it no longer needs to return `ntfyServerUrl`.

---

## Step 7 — Dispatcher (`packages/backend/src/notifications/dispatcher.ts`)

Rewrite to reflect the mixed model:

```
For email channel:
  - Fetch opted-in verified users (existing logic, email channel only)
  - For each user: check deduplication log, send, log if sent

For ntfy, telegram, discord channels:
  - Check if channel is enabled (env var present)
  - Check deduplication log using userId = 0 as sentinel
  - Send once to the configured endpoint
  - Log if sent
```

Remove the outer `for (const channel of CHANNELS)` + inner `for (const user of users)` loop structure. Email keeps its user loop; broadcast channels each get a simple conditional block.

---

## Step 8 — Backend routes

### Remove from `user.ts`
- `PATCH /notifications/ntfy-url`
- `POST /notifications/test-ntfy`

### Keep in `user.ts`
- `PATCH /notifications/preferences` — still needed for email opt-outs.
- `GET /notifications/preferences` — still needed for the Settings page; response no longer includes `ntfyServerUrl`.

### Add to `admin.ts` (admin-only test routes)
- `POST /admin/notifications/test` — triggers a test dispatch to all configured broadcast channels. Useful for verifying bot/webhook config after setup. Does not log to the notification log (or uses a distinct `notificationType` like `'test'` that the dedup check ignores).

---

## Step 9 — Frontend Settings page (`packages/frontend/src/pages/Settings.tsx`)

**Remove:**
- NTFY section (text field, save button, test button)

**Keep:**
- Account section (email + verified/unverified chip + resend verification button)
- Notification preferences grid, but email column only — remove ntfy column. The grid now shows a single column of checkboxes (one per notification type) rather than a channels × types matrix.

**Remove from `userRequests.ts`:**
- `updateNtfyUrl`
- `sendTestNtfy`

---

## Step 10 — Validators

**Remove:**
- `ntfyUrlValidator`

**Keep:**
- `notificationPreferenceValidator` — still used for email opt-outs. Update its `channel` enum to only accept `'email'`.

---

## Step 11 — Tests

### `packages/backend/tests/telegramSender.test.ts` (new)
- Returns `true` on 200 response.
- Returns `false` and logs on non-OK response.
- Returns `false` and logs on network error.

### `packages/backend/tests/discordSender.test.ts` (new)
- Same three cases as above.

### `packages/backend/tests/ntfySender.test.ts` (update)
- Remove per-user URL / userId tests.
- Add: returns `false` when `ntfyEnabled` is false.
- Keep: returns `true` on 200, `false` on non-OK, `false` on network error.

### `packages/backend/tests/dispatcher.test.ts` (update)
- Remove per-user ntfy eligibility tests.
- Add: broadcast channels skip send when env var not configured.
- Add: broadcast channels use `userId = 0` for deduplication.
- Keep: email channel loops over opted-in verified users.

### Frontend tests
- Remove: ntfy URL validation tests.
- Keep: email notification preference toggle tests.

---

## Step 12 — Documentation

- Update `CLAUDE.md`: replace ntfy env var docs with `NTFY_TOPIC_URL`; add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DISCORD_WEBHOOK_URL`.
- Update `docs/NOTIFICATIONS.md`: reflect broadcast model, mark Telegram and Discord as implemented.

---

## File change summary

| File | Change |
|---|---|
| `packages/shared/types/cfb-pickem-api.ts` | Add channel values; remove `ntfyServerUrl` from interfaces |
| `packages/backend/src/db/schema/users.ts` | Drop `ntfy_server_url` column |
| `packages/backend/src/db/dbNotificationFunctions.ts` | Remove `updateUserNtfyUrl`; rename/update `returnOptedInUsers` to email-only; update log sentinel |
| `packages/backend/src/utils/envVars.ts` | Add 4 new env vars + enabled flags |
| `packages/backend/src/notifications/ntfySender.ts` | Remove userId / per-user URL; read from env vars |
| `packages/backend/src/notifications/telegramSender.ts` | New file |
| `packages/backend/src/notifications/discordSender.ts` | New file |
| `packages/backend/src/notifications/dispatcher.ts` | Rewrite for mixed model |
| `packages/backend/src/routes/user.ts` | Remove ntfy routes; keep preferences routes |
| `packages/backend/src/routes/admin.ts` | Add test broadcast route |
| `packages/backend/src/utils/validators.ts` | Remove `ntfyUrlValidator`; restrict preference validator to email channel |
| `packages/frontend/src/apis/userRequests.ts` | Remove ntfy API functions |
| `packages/frontend/src/pages/Settings.tsx` | Remove ntfy section; slim preferences grid to email column only |
| `packages/backend/tests/ntfySender.test.ts` | Update for env-var model |
| `packages/backend/tests/telegramSender.test.ts` | New file |
| `packages/backend/tests/discordSender.test.ts` | New file |
| `packages/backend/tests/dispatcher.test.ts` | Update for mixed model |
| `CLAUDE.md` | Update env var docs |
| `docs/NOTIFICATIONS.md` | Reflect broadcast model; mark as implemented |
