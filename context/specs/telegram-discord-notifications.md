# Spec for telegram-discord-notifications

branch: claude/feature/telegram-discord-notifications

## Summary

Add Telegram and Discord as notification channels alongside the existing email and NTFY channels. Users can configure either or both in Settings. The backend dispatcher routes notifications to these new channels the same way it does for email and NTFY.

## Functional Requirements

- Users can save a Telegram chat ID in Settings to receive notifications via a shared Telegram bot.
- Users can save a Discord user ID in Settings to receive notifications via a shared Discord bot DM.
- Both fields are optional and independent of each other and existing channels.
- The backend dispatcher sends notifications to `telegram` and `discord` channels for opted-in users, following the same deduplication and opt-in logic as email and NTFY.
- Notification preferences (games_ready, picks_reminder, rankings_updated) are available for both new channels in the preferences grid, disabled if the user has not configured that channel.
- A "Send test notification" button is available for each configured channel in Settings.
- Telegram and Discord bot tokens are configured via backend environment variables — not stored per-user.
- If a bot token env var is not set, that channel is silently skipped during dispatch (same pattern as email's `NOTIFICATION_FROM_EMAIL`).
- Saving an empty value for either field clears the stored ID and disables that channel.

## Possible Edge Cases

- User provides an invalid Telegram chat ID or Discord user ID (non-numeric, wrong format). The sender returns false; the error is logged but does not affect other channels.
- Bot cannot DM the Discord user because they have DMs disabled or do not share a server with the bot. The sender returns false and logs a warning.
- Telegram bot is blocked by the user. Telegram API returns 403; the sender returns false and logs a warning.
- User saves a Telegram or Discord ID but the corresponding bot token env var is not set. The channel is skipped at dispatch time.
- Dispatch is triggered for a user who has enabled a channel in preferences but has since cleared their ID. The dispatcher's channel eligibility check skips them (same as ntfy's `!user.ntfyServerUrl` guard).
- Rate limits from Telegram or Discord APIs during bulk dispatch (e.g. rankings_updated sent to many users). Each send is independent; a rate limit error is caught per-user and logged.

## Acceptance Criteria

- A user with a valid Telegram chat ID and the `telegram` channel enabled receives a Telegram message when a notification is dispatched.
- A user with a valid Discord user ID and the `discord` channel enabled receives a Discord DM when a notification is dispatched.
- A user with no Telegram chat ID set cannot enable the `telegram` channel in the preferences grid (checkbox disabled with tooltip).
- A user with no Discord user ID set cannot enable the `discord` channel in the preferences grid (checkbox disabled with tooltip).
- Test notification buttons work for both channels and report success/failure.
- If a bot token env var is absent, the channel is excluded from dispatch without error.
- Existing email and NTFY behavior is unchanged.
- Notification deduplication (notification log) prevents duplicate sends for both new channels.

## Open Questions

- Should Discord use a bot (requires bot token + users sharing a server) or per-server webhooks? Bot DMs are per-user and match the model of the other channels; webhooks are broadcast-only. This spec assumes bot DMs. - lets just do webhooks
- Does the Telegram bot need a `/start` flow or onboarding message? Users need to message the bot first before it can DM them. Should the Settings page link to the bot and explain this? - that sounds good.  whatever you think is best.
- Should the Discord user ID field accept a username (e.g. `username`) or require a numeric user ID? Numeric IDs are unambiguous but less user-friendly. - I guess usernames
- Should channel availability (i.e. bot token is configured) be surfaced to the frontend so that Telegram/Discord sections are hidden entirely when not configured by the admin? - yes, hide if not set up.

## Testing Guidelines

Create test file(s) in the `./tests` folder for the new feature, and create meaningful tests for the following cases, without going too heavy:

- `telegramSender`: returns `true` on a successful API response, returns `false` and logs on a non-OK response, returns `false` on a network error.
- `discordSender`: same three cases as above.
- Dispatcher eligibility checks: users without a `telegramChatId` are skipped for the `telegram` channel; same for `discordUserId`.
- Settings form validation: Telegram chat ID and Discord user ID fields accept valid numeric IDs and reject clearly invalid input.

## Personal Opinion

This is a good addition. Telegram is low-effort — the API is nearly identical to ntfy, and it's legitimately useful for users who don't self-host ntfy. Discord is reasonable given the CFB audience overlap, though the DM model requires users to share a server with the bot, which adds friction for a private/friend-group app. If the user group already has a Discord server, it's worth it; otherwise a shared channel webhook might be more practical than per-user DMs.

The main concern is bot management: you now have two long-running bot tokens to maintain, and if either bot goes down or is rate-limited, notifications silently fail. That's acceptable given the low-stakes nature of the app, but worth noting.

The implementation is straightforward — two new sender modules, two new DB columns, two new `NotificationChannel` values, and frontend Settings additions. No migration complexity beyond adding nullable columns.
