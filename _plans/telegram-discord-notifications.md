# Plan: Broadcast Notifications — Telegram, Discord, and ntfy Refactor

Spec: `_specs/telegram-discord-notifications.md`

## Architecture decision

All notification channels (email, ntfy, Telegram, Discord) are now **broadcast**: the admin configures endpoints via env vars, and the backend sends once per event. Per-user channel configuration and opt-outs are removed entirely.

- **Email**: still per-user (individual addresses required), but sent to all users with verified emails — no opt-out.
- **ntfy**: admin configures one topic URL; backend POSTs once per event.
- **Telegram**: admin configures bot token + group/channel chat ID; backend sends once per event.
- **Discord**: admin configures one webhook URL; backend POSTs once per event.

**Note on email opt-outs:** Removing opt-outs means every verified user receives every notification. For a small friend-group app this is fine, but worth keeping in mind if the user base grows.

---

## Step 1 — Database migrations (`packages/backend/src/db/schema/users.ts`)

**Remove** the `ntfy_server_url` column from the `users` table — it is no longer used.

**Drop** the `notification_preferences` table entirely — per-user opt-outs are gone.

The `notification_log` table stays for broadcast deduplication. Since broadcasts are not per-user, use `userId = 0` as a sentinel value when logging a broadcast send. This reuses the existing unique constraint `(userId, year, weekNumber, notificationType, channel)` to prevent duplicate broadcasts.

Run `pnpm generate` then `pnpm migrate` to apply both changes.

---

## Step 2 — Shared types (`packages/shared/types/cfb-pickem-api.ts`)

- Add `"telegram"` and `"discord"` to the `NotificationChannel` union.
- Remove `ntfyServerUrl` from `NotificationSettings` and `UserDbData`.
- Remove the `preferences` array from `NotificationSettings` — opt-outs are gone. The interface may be removed entirely if nothing else uses it; otherwise slim it down to just `emailVerified`.
- `NotificationChannel` stays (still used by the notification log).

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

- **Remove** `returnOptedInUsers` — no longer needed.
- **Remove** `updateUserNtfyUrl` — no longer needed.
- **Remove** `upsertNotificationPreference` — no longer needed.
- **Add** `returnVerifiedEmailUsers(): Promise<{ userId: number, email: string }[]>` — returns all users with `emailVerified = true`. Used by the email channel in the dispatcher.
- **Update** `hasNotificationBeenSent` / `addNotificationLog` to support `userId = 0` as the broadcast sentinel for non-email channels.
- **Update** `getUserNotificationSettings` (used by `GET /notifications/preferences`) to only return `emailVerified` — or remove the route entirely if the Settings page no longer needs it (see Step 9).

---

## Step 7 — Dispatcher (`packages/backend/src/notifications/dispatcher.ts`)

Rewrite to reflect the broadcast model:

```
For email channel:
  - Fetch all verified-email users
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
- `PATCH /notifications/preferences`
- `GET /notifications/preferences` — remove if Settings page no longer needs notification data (it won't after Step 9). Otherwise keep and slim the response to just `{ emailVerified }`.

### Add to `admin.ts` (admin-only test routes)
- `POST /admin/notifications/test` — triggers a test dispatch to all configured broadcast channels. Useful for verifying bot/webhook config after setup. Does not log to the notification log (or uses a distinct `notificationType` like `'test'` that the dedup check ignores).

---

## Step 9 — Frontend Settings page (`packages/frontend/src/pages/Settings.tsx`)

**Remove entirely:**
- NTFY section (text field, save button, test button)
- Notification preferences grid (channels × notification types checkboxes)

**What remains:**
- Account section (email + verified/unverified chip + resend verification button)

The Settings page becomes minimal. If it feels too bare, it can be renamed or merged into a profile page later — that is out of scope here.

**Remove from `userRequests.ts`:**
- `updateNtfyUrl`
- `sendTestNtfy`
- `updateNotificationPreference`
- `getNotificationSettings` (if the route is removed)

---

## Step 10 — Validators

**Remove:**
- `ntfyUrlValidator`
- `notificationPreferenceValidator`

No new per-user validators needed — broadcast channels are admin-configured via env vars.

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
- Remove opted-in user / per-user eligibility tests.
- Add: broadcast channels skip send when env var not configured.
- Add: broadcast channels use `userId = 0` for deduplication.
- Add: email channel still loops over verified users only.

### Frontend tests
- Remove: ntfy URL validation tests.
- Remove: notification preference toggle tests.

---

## Step 12 — Documentation

- Update `CLAUDE.md`: replace ntfy env var docs with `NTFY_TOPIC_URL`; add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DISCORD_WEBHOOK_URL`.
- Update `docs/NOTIFICATIONS.md`: reflect broadcast model, mark Telegram and Discord as implemented.

---

## File change summary

| File | Change |
|---|---|
| `packages/shared/types/cfb-pickem-api.ts` | Add channel values; remove per-user notification fields |
| `packages/backend/src/db/schema/users.ts` | Drop `ntfy_server_url`; drop `notification_preferences` table |
| `packages/backend/src/db/dbNotificationFunctions.ts` | Remove per-user functions; add `returnVerifiedEmailUsers`; update log sentinel |
| `packages/backend/src/utils/envVars.ts` | Add 4 new env vars + enabled flags |
| `packages/backend/src/notifications/ntfySender.ts` | Remove userId / per-user URL; read from env vars |
| `packages/backend/src/notifications/telegramSender.ts` | New file |
| `packages/backend/src/notifications/discordSender.ts` | New file |
| `packages/backend/src/notifications/dispatcher.ts` | Rewrite for broadcast model |
| `packages/backend/src/routes/user.ts` | Remove ntfy + preferences routes |
| `packages/backend/src/routes/admin.ts` | Add test broadcast route |
| `packages/backend/src/utils/validators.ts` | Remove ntfy + preference validators |
| `packages/frontend/src/apis/userRequests.ts` | Remove ntfy + preference API functions |
| `packages/frontend/src/pages/Settings.tsx` | Remove ntfy section and preferences grid |
| `packages/backend/tests/ntfySender.test.ts` | Update for env-var model |
| `packages/backend/tests/telegramSender.test.ts` | New file |
| `packages/backend/tests/discordSender.test.ts` | New file |
| `packages/backend/tests/dispatcher.test.ts` | Update for broadcast model |
| `CLAUDE.md` | Update env var docs |
| `docs/NOTIFICATIONS.md` | Reflect broadcast model; mark as implemented |
