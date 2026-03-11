# Notification Services

Reference document for notification channels supported or under consideration.

---

## Implemented

### Email (SMTP)
- **How it works:** Backend sends via nodemailer using configurable SMTP credentials. Per-user — each user receives a separate email.
- **User setup:** Must register with a valid email and verify it. No additional account needed.
- **Config:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `NOTIFICATION_FROM_EMAIL` env vars.
- **Opt-out:** Users can disable individual notification types in Settings.
- **Cost:** Depends on SMTP provider. Free with Fastmail, Gmail, or a self-hosted Mailpit instance.
- **Pros:** Universal — every user has an email. No extra app required.
- **Cons:** Deliverability concerns (spam filters). Slower to notice than push.

### NTFY (broadcast)
- **How it works:** Admin configures one ntfy topic URL. Backend POSTs once per event to that topic. All subscribers to the topic receive the notification.
- **User setup:** None — users subscribe to the admin-configured topic in the ntfy app.
- **Config:** `NTFY_TOPIC_URL` env var (full URL including topic, e.g. `https://ntfy.sh/cfb-pickem`). Leave blank to disable.
- **Opt-out:** Users unsubscribe from the ntfy topic directly.
- **Cost:** Free (public ntfy.sh) or self-hosted.
- **Pros:** Privacy-friendly, self-hostable, simple API.
- **Cons:** Niche — requires users to know what ntfy is and subscribe to the topic.

### Telegram (broadcast)
- **How it works:** Admin creates a bot via BotFather and configures the bot token + a group/channel chat ID. Backend POSTs once per event to that chat.
- **User setup:** None — users join the admin-configured Telegram group or channel.
- **Config:** `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` env vars. Both must be set to enable. Leave blank to disable.
- **Opt-out:** Users mute or leave the Telegram group/channel directly.
- **Cost:** Free.
- **Pros:** Widely used, reliable delivery, no self-hosting.
- **Cons:** Requires a Telegram account.

### Discord (broadcast)
- **How it works:** Admin creates a webhook URL for a Discord channel. Backend POSTs once per event to that webhook.
- **User setup:** None — users join the Discord server and follow the channel.
- **Config:** `DISCORD_WEBHOOK_URL` env var. Leave blank to disable.
- **Opt-out:** Users mute the Discord channel or server directly.
- **Cost:** Free.
- **Pros:** CFB audience overlaps heavily with Discord. Zero implementation friction for webhook approach.
- **Cons:** Broadcast-only — not per-user.

---

## Broadcast model

ntfy, Telegram, and Discord all use the **broadcast model**: admin configures one endpoint, backend sends once per event. Per-user opt-in/opt-out for these channels happens outside the app (by joining/leaving the group or subscribing to the topic).

Email remains **per-user**: each user receives a separate email, and can opt out of specific notification types in Settings.

---

## Deduplication

All channels use the `notification_log` table to prevent duplicate sends within the same event (year/week/notificationType/channel). Broadcast channels use `userId = 0` as a sentinel to record that the broadcast was sent.

---

## Admin test endpoint

`POST /api/admin/notifications/test` triggers a test send to all configured broadcast channels. Results are returned per-channel. This endpoint does not write to the notification log (no deduplication effect).

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
