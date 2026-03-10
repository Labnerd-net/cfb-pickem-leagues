# Plan: Telegram and Discord Notifications

Spec: `_specs/telegram-discord-notifications.md`

## Decisions from spec annotations

- **Discord**: per-user webhook URLs (user provides their own), not a bot. No server-side Discord token needed. The webhook URL is the credential.
- **Telegram**: users provide their numeric chat ID. Backend holds `TELEGRAM_BOT_TOKEN` in env vars. Settings page links to the bot with `/start` instructions.
- **Channel availability**: backend exposes whether Telegram is configured (token present). Discord is always available (no server config). Frontend hides the Telegram section if the token is absent.

---

## Step 1 — Shared types (`packages/shared/types/cfb-pickem-api.ts`)

- Add `"telegram"` and `"discord"` to the `NotificationChannel` union.
- Add `telegramChatId: string | null` and `discordWebhookUrl: string | null` to `NotificationSettings`.
- Add the same two fields to `UserDbData`.
- Add `telegramEnabled: boolean` to `NotificationSettings` (driven by server-side token presence; always `true` for Discord).

---

## Step 2 — Database schema & migration (`packages/backend/src/db/schema/users.ts`)

- Add `telegramChatId: text('telegram_chat_id')` (nullable) to the `users` table.
- Add `discordWebhookUrl: text('discord_webhook_url')` (nullable) to the `users` table.
- Run `pnpm generate` then `pnpm migrate` to apply.

---

## Step 3 — Environment variables (`packages/backend/src/utils/envVars.ts`)

- Add `telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || ''`.
- Add `telegramEnabled: telegramBotToken !== ''` (mirrors `notificationsEnabled` pattern).
- Document both in `CLAUDE.md` under Environment Variables.

---

## Step 4 — Sender modules (`packages/backend/src/notifications/`)

### `telegramSender.ts`
- Accepts `{ chatId: string, title: string, message: string }`.
- POSTs to `https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage` with `chat_id` and `text` (formatted as `*{title}*\n{message}` using Markdown parse mode).
- Returns `false` and logs on non-OK response or network error. Logs 403 as a warning (bot blocked).

### `discordSender.ts`
- Accepts `{ webhookUrl: string, title: string, message: string }`.
- POSTs to the webhook URL with `{ content: "**{title}**\n{message}" }` as JSON.
- Returns `false` and logs on non-OK response or network error.

---

## Step 5 — DB functions (`packages/backend/src/db/dbNotificationFunctions.ts`)

- Update `returnOptedInUsers` to also select `telegramChatId` and `discordWebhookUrl` from `users`.
- Update the return type to include both new fields.
- Update `getUserNotificationSettings` to include `telegramChatId`, `discordWebhookUrl`, and `telegramEnabled` in the returned object.
- Add `updateUserTelegramChatId(userId, chatId | null)`.
- Add `updateUserDiscordWebhookUrl(userId, webhookUrl | null)`.

---

## Step 6 — Dispatcher (`packages/backend/src/notifications/dispatcher.ts`)

- Add `'telegram'` and `'discord'` to the `CHANNELS` array.
- Add eligibility checks in the per-user loop:
  - `telegram`: skip if `!telegramEnabled` (no bot token) or `!user.telegramChatId`.
  - `discord`: skip if `!user.discordWebhookUrl`.
- Call `sendTelegramNotification` and `sendDiscordNotification` in the respective channel branches.

---

## Step 7 — Validators (`packages/backend/src/utils/validators.ts` or equivalent)

- Add `telegramChatIdValidator`: body `{ telegramChatId: string | null }`. Chat IDs are numeric strings; validate with a regex or `z.string().regex(/^-?\d+$/).nullable()`.
- Add `discordWebhookUrlValidator`: body `{ discordWebhookUrl: string | null }`. Validate as URL with `z.string().url().nullable()`.

---

## Step 8 — Backend routes (`packages/backend/src/routes/user.ts`)

Add four new routes:

- `PATCH /notifications/telegram-chat-id` — validates and saves the user's Telegram chat ID.
- `POST /notifications/test-telegram` — sends a test message to the user's stored chat ID.
- `PATCH /notifications/discord-webhook-url` — validates and saves the user's Discord webhook URL.
- `POST /notifications/test-discord` — sends a test message to the user's stored webhook URL.

The existing `GET /notifications/preferences` route already returns `NotificationSettings` — extend its response to include `telegramChatId`, `discordWebhookUrl`, and `telegramEnabled` now that those fields are on the shared type.

---

## Step 9 — Frontend API functions (`packages/frontend/src/apis/userRequests.ts`)

Add:
- `updateTelegramChatId(chatId: string | null)`
- `sendTestTelegram()`
- `updateDiscordWebhookUrl(webhookUrl: string | null)`
- `sendTestDiscord()`

All call through the Hono RPC client. Do not use `fetch` directly.

---

## Step 10 — Frontend Settings page (`packages/frontend/src/pages/Settings.tsx`)

### Telegram section
- Only render if `settings.telegramEnabled` is `true`.
- Text field for chat ID (numeric). Zod schema: `z.string().regex(/^-?\d+$/, 'Must be a numeric chat ID').or(z.literal(''))`.
- Helper text: explains the user must message the bot first to get a chat ID, with a link to the bot (`t.me/{BOT_USERNAME}`). Note: bot username is a constant in the frontend or returned from the backend.
- Save button + "Send test" button (disabled if no chat ID saved).
- Populate field on load via `reset()` (same pattern as ntfy).

### Discord section
- Always rendered (no server-side token dependency).
- Text field for webhook URL. Zod schema: `z.string().url().or(z.literal(''))`.
- Helper text: explains how to create a webhook in Discord channel settings.
- Save button + "Send test" button (disabled if no URL saved).
- Populate field on load via `reset()`.

### Preferences grid
- `CHANNELS` array gains `{ value: 'telegram', label: 'Telegram' }` and `{ value: 'discord', label: 'Discord' }`.
- Disable/tooltip logic mirrors the ntfy pattern: disabled if no chat ID / webhook URL configured.
- Conditionally exclude `telegram` from the grid if `!settings.telegramEnabled`.

---

## Step 11 — Tests

### `packages/backend/tests/telegramSender.test.ts`
- Returns `true` on 200 response.
- Returns `false` and logs `warn` on 403 (bot blocked).
- Returns `false` and logs `error` on other non-OK responses.
- Returns `false` and logs `error` on network error.

### `packages/backend/tests/discordSender.test.ts`
- Same three/four cases as above.

### `packages/backend/tests/dispatcher.test.ts` (extend or add)
- User without `telegramChatId` is skipped for `telegram` channel.
- User without `discordWebhookUrl` is skipped for `discord` channel.
- `telegram` channel is skipped entirely when `telegramEnabled` is `false`.

### `packages/frontend/tests/` (extend settings form tests)
- Telegram chat ID field: accepts `"123456789"` and `"-100123456789"` (group chats), rejects `"notanumber"`.
- Discord webhook URL field: accepts a valid `https://discord.com/api/webhooks/...` URL, rejects plain text.

---

## Step 12 — Documentation

- Update `CLAUDE.md` Environment Variables section: add `TELEGRAM_BOT_TOKEN`.
- Update `docs/NOTIFICATIONS.md`: mark Telegram and Discord as implemented.

---

## File change summary

| File | Change |
|---|---|
| `packages/shared/types/cfb-pickem-api.ts` | Add channel values, new fields to interfaces |
| `packages/backend/src/db/schema/users.ts` | Add 2 nullable columns |
| `packages/backend/src/db/dbNotificationFunctions.ts` | Select new columns, add 2 update functions |
| `packages/backend/src/utils/envVars.ts` | Add `telegramBotToken`, `telegramEnabled` |
| `packages/backend/src/notifications/telegramSender.ts` | New file |
| `packages/backend/src/notifications/discordSender.ts` | New file |
| `packages/backend/src/notifications/dispatcher.ts` | Add 2 channels, eligibility checks, sender calls |
| `packages/backend/src/utils/validators.ts` (or similar) | Add 2 validators |
| `packages/backend/src/routes/user.ts` | Add 4 routes, extend settings response |
| `packages/frontend/src/apis/userRequests.ts` | Add 4 API functions |
| `packages/frontend/src/pages/Settings.tsx` | Add Telegram + Discord sections, update grid |
| `packages/backend/tests/telegramSender.test.ts` | New file |
| `packages/backend/tests/discordSender.test.ts` | New file |
| `packages/backend/tests/dispatcher.test.ts` | Extend |
| `packages/frontend/tests/` | Extend settings form tests |
| `CLAUDE.md` | Document new env var |
| `docs/NOTIFICATIONS.md` | Mark as implemented |
