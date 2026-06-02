# Spec for admin-broadcast-notifications

Title: Admin Broadcast Notifications (League-Scoped and Platform-Wide)
Branch: claude/feature/admin-broadcast-notifications
Spec file: context/specs/admin-broadcast-notifications.md

## Summary

Split the existing single admin broadcast feature into two distinct broadcast types with distinct channel ownership:

1. **League broadcast** — sent by a league admin (`LeagueRole = 'admin'`) to members of their league via all channels configured for that league (email + league-configured ntfy/Telegram/Discord). League admins configure their own notification channels per league, stored in the database.
2. **Platform broadcast** — sent by a platform admin (`Role = 'admin'`) to all users via email only. The existing site-wide ntfy/Telegram/Discord env var channels are retired from the platform broadcast and become league-level configuration instead.

Both role types already exist in the shared types (`Role` and `LeagueRole`). The primary schema change is adding per-league channel configuration, replacing the current site-wide env vars for broadcast channels.

## Functional Requirements

### League Broadcast
- Any user with `LeagueRole = 'admin'` can send a broadcast to members of their league
- Scoped to that league's members only — no cross-league access
- Email includes the league name in subject and body (via existing branded template)
- Also dispatches to ntfy, Telegram, and Discord channels configured for that league (if set)
- Goes through existing notification opt-in and email-verified checks for email channel
- Broadcast channels (ntfy/Telegram/Discord) are sent regardless of individual user opt-in (they are opt-in at the channel level by subscribing)
- Available via a "Send Message" action in the league management UI
- League admins configure their league's notification channels in league settings (ntfy topic URL, Telegram bot token + chat ID + invite URL, Discord webhook URL + invite URL)

### Platform Broadcast
- Only users with `Role = 'admin'` can send platform broadcasts
- Sent to all verified users across all leagues via email only
- Supports existing `overrideEmailPreferences` flag
- No ntfy/Telegram/Discord — those are now league-owned
- No league name included — this is a site-wide message
- Remains in the platform admin panel (existing location)

### Per-League Channel Configuration
- League channel config is stored in the database (new `league_channels` table or columns on `leagues`)
- Fields: `ntfy_topic_url`, `telegram_bot_token`, `telegram_chat_id`, `telegram_invite_url`, `discord_webhook_url`, `discord_invite_url`
- League admin can set/update these via a "Notification Channels" section in league settings UI
- The existing env vars (`NTFY_TOPIC_URL`, `TELEGRAM_BOT_TOKEN`, etc.) are deprecated — existing values should be migrated to the default league's channel config as part of the migration
- The `GET /api/user/notifications/channels` endpoint (which currently returns channel availability based on env vars) should be updated to return channels configured for the user's leagues

## Possible Edge Cases

- A user with `LeagueRole = 'admin'` but `Role = 'user'` cannot access the platform broadcast endpoint
- A user with `LeagueRole = 'admin'` for League A cannot broadcast to League B
- A league with no members (only the admin) sends without error
- A league with no channels configured sends email only — no error for missing channels
- Users in multiple leagues can receive a broadcast from each league independently; deduplication does not suppress across leagues
- `overrideEmailPreferences` on a league broadcast only overrides for members of that league
- Migrating env var channel values to the default league must be idempotent (safe to run multiple times)

## Acceptance Criteria

- [ ] New `league_channels` schema (or columns on `leagues`) stores per-league ntfy/Telegram/Discord config
- [ ] Migration moves existing env var channel values into the default league's channel config
- [ ] `POST /api/leagues/:leagueId/broadcast` — new endpoint, requires `LeagueRole = 'admin'` for that league
- [ ] League broadcast sends email to league members and dispatches to league-configured broadcast channels
- [ ] League name appears in league broadcast email subject and body
- [ ] `GET /api/user/notifications/channels` returns channels for the user's leagues (not env vars)
- [ ] League settings UI includes a "Notification Channels" form for ntfy/Telegram/Discord configuration
- [ ] League admin UI includes a "Send Message to League" form (subject + message + override toggle)
- [ ] Platform broadcast (`POST /api/admin/broadcast`) sends email only — no broadcast channels
- [ ] Platform admin UI retains existing broadcast form, unchanged
- [ ] A user with `LeagueRole = 'admin'` but `Role = 'user'` cannot access `POST /api/admin/broadcast`
- [ ] A user cannot broadcast to a league where they have `LeagueRole = 'member'` or no membership (403)
- [ ] Env vars for broadcast channels are no longer required — app starts cleanly without them
- [ ] `pnpm build` passes

## Open Questions

- Should the platform admin still be able to configure site-wide fallback channels (env vars) for leagues that haven't set up their own? Probably not — keep it clean: league channels are league-owned only.
- Should league admins see a history/log of broadcasts they've sent? Out of scope for now.
- Should platform admin be able to send to broadcast channels at all? Recommendation: no — platform comms are personal (email) and broadcast channels belong to leagues.
- For the `GET /api/user/notifications/channels` response: should it return channels per league, or a union of all channels the user has access to? Likely per-league since a user might be in leagues with different channel setups.

## Testing Guidelines

Create tests in `packages/backend/tests/` for:
- League broadcast endpoint returns 403 if caller has `LeagueRole = 'member'` or no membership in the target league
- Platform broadcast endpoint returns 403 if caller has `Role = 'user'`
- League broadcast sends only to members of the target league
- League broadcast dispatches to league-configured channels (ntfy/Telegram/Discord) when configured
- League broadcast with no channels configured sends email only without error
- `GET /api/user/notifications/channels` returns league-specific channel config

## Personal Opinion

This is the right long-term model. Broadcast channels naturally belong to communities (leagues), not the platform. Platform admin communicating via a shared Discord or ntfy channel is inherently awkward — those channels are community spaces, not admin loudspeakers.

The biggest complexity is the schema migration (per-league channel config + migrating existing env var values) and updating `GET /api/user/notifications/channels` which currently drives channel display in the frontend Settings page. That endpoint will need to become league-aware, which may require UI changes to show per-league channel info.

This is a medium-large feature. The cleanest approach is to tackle it in this order: schema + migration first, then API (broadcast endpoint + channel config endpoints), then UI (channel config form + league broadcast form + updated Settings page).
