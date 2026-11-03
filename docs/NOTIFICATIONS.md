# Notification Services

Reference document for notification channels supported or under consideration.

---

## Implemented

### Email (Resend)
- **How it works:** Backend sends via the [Resend](https://resend.com) API. Per-user — each user receives a separate email.
- **User setup:** Must register with a valid email and verify it. No additional account needed.
- **Config:** `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` env vars (the from-address must be on a Resend-verified domain). Leave either blank to disable email. `SKIP_EMAIL_SEND=true` logs instead of sending.
- **Opt-out:** Users can disable individual notification types in Settings.
- **Cost:** Resend free tier covers small leagues; paid beyond that.
- **Pros:** Universal — every user has an email. No extra app required.
- **Cons:** Deliverability concerns (spam filters). Slower to notice than push.

### NTFY (broadcast, per league)
- **How it works:** A league admin configures an ntfy topic URL in League Settings. Backend POSTs once per event to that topic. All subscribers to the topic receive the notification.
- **User setup:** None — users subscribe to the league's topic in the ntfy app.
- **Config:** Stored per league in the `league_channels` table, edited via `PATCH /api/leagues/:leagueId/channels`. Not an env var.
- **Opt-out:** Users unsubscribe from the ntfy topic directly.
- **Cost:** Free (public ntfy.sh) or self-hosted.
- **Pros:** Privacy-friendly, self-hostable, simple API.
- **Cons:** Niche — requires users to know what ntfy is and subscribe to the topic.

### Telegram (broadcast, per league)
- **How it works:** A league admin creates a bot via BotFather and enters the bot token and a group/channel chat ID in League Settings. Backend POSTs once per event to that chat.
- **User setup:** None — users join the league's Telegram group or channel (an optional invite URL is shown in Settings).
- **Config:** Bot token, chat ID, and invite URL stored per league in `league_channels`. Not env vars.
- **Opt-out:** Users mute or leave the Telegram group/channel directly.
- **Cost:** Free.
- **Pros:** Widely used, reliable delivery, no self-hosting.
- **Cons:** Requires a Telegram account.

### Discord (broadcast, per league)
- **How it works:** A league admin creates a webhook URL for a Discord channel and enters it in League Settings. Backend POSTs once per event to that webhook.
- **User setup:** None — users join the Discord server and follow the channel (an optional invite URL is shown in Settings).
- **Config:** Webhook URL and invite URL stored per league in `league_channels`. Not env vars.
- **Opt-out:** Users mute the Discord channel or server directly.
- **Cost:** Free.
- **Pros:** CFB audience overlaps heavily with Discord. Zero implementation friction for webhook approach.
- **Cons:** Broadcast-only — not per-user.

---

## Broadcast model

ntfy, Telegram, and Discord all use the **broadcast model**: a league admin configures one endpoint per channel for their league, and the backend sends once per event per league. Per-user opt-in/opt-out for these channels happens outside the app (by joining/leaving the group or subscribing to the topic).

Email remains **per-user**: each user receives a separate email, and can opt out of specific notification types in Settings.

League admins can also send a free-form message to their league (`POST /api/leagues/:leagueId/broadcast`), which goes out as email plus the league's configured channels. The site-admin broadcast (`POST /api/admin/notifications/broadcast`) is email-only.

---

## Deduplication

All channels use the `notification_log` table to prevent duplicate sends within the same event (league/year/week/notificationType/channel). Broadcast channels use `userId = 0` as a sentinel to record that the broadcast was sent.

---

## Candidates

### Pushover
- **How it works:** User creates a Pushover account and gets a user key. Backend POSTs to `https://api.pushover.net/1/messages.json` with the app token and user key.
- **User setup:** User stores their Pushover user key in Settings.
- **Cost:** App token is free. Users pay a one-time $5/platform fee for the mobile app.
- **Pros:** Reliable, clean mobile app, simple API, no self-hosting.
- **Cons:** Per-user cost creates friction. Less likely to be adopted by casual users.
- **Implementation complexity:** Low. One new sender module, one new DB column.

### Web Push (PWA)
- **How it works:** Browser subscribes to push via the Push API and a service worker. Backend stores the push subscription and sends via the Web Push protocol (VAPID keys).
- **User setup:** User clicks "Enable notifications" in the browser. No external account needed.
- **Cost:** Free.
- **Pros:** No third-party app or account required. Works on desktop and mobile browsers. Most seamless UX if implemented well.
- **Cons:** Browser permission prompt UX is notoriously poor (users often dismiss or block). Requires a service worker, VAPID key generation, a push subscription storage table, and subscription lifecycle management. Most complex option on this list.
- **Implementation complexity:** High.

### SMS (Twilio / AWS SNS)
- **How it works:** Backend sends SMS via a third-party API using the user's phone number.
- **User setup:** User provides a verified phone number.
- **Cost:** Per-message cost (Twilio: ~$0.0079/SMS in the US). Adds up at scale.
- **Pros:** High visibility — SMS open rates are very high. No app required.
- **Cons:** Ongoing cost. Requires phone number collection and verification. Overkill for a pick'em game.
- **Implementation complexity:** Medium (plus phone verification flow).

---

## Summary

| Channel     | Model     | Cost       | User Effort | Impl. Complexity | Status      |
|-------------|-----------|------------|-------------|------------------|-------------|
| Email       | Per-user  | Low        | None        | Done             | Implemented |
| NTFY        | Broadcast | Free       | Low         | Done             | Implemented |
| Telegram    | Broadcast | Free       | Low         | Done             | Implemented |
| Discord     | Broadcast | Free       | Low         | Done             | Implemented |
| Pushover    | Per-user  | $5/user    | Low         | Low              | Candidate   |
| Web Push    | Per-user  | Free       | None        | High             | Candidate   |
| SMS         | Per-user  | Per-msg    | Low         | Medium           | No          |
