# Notification Services

Reference document for notification channels supported or under consideration.

---

## Implemented

### Email (SMTP)
- **How it works:** Backend sends via nodemailer using configurable SMTP credentials.
- **User setup:** Must register with a valid email and verify it. No additional account needed.
- **Config:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `NOTIFICATION_FROM_EMAIL` env vars.
- **Cost:** Depends on SMTP provider. Free with Fastmail, Gmail, or a self-hosted Mailpit instance.
- **Pros:** Universal — every user has an email. No extra app required.
- **Cons:** Deliverability concerns (spam filters). Slower to notice than push.

### NTFY
- **How it works:** Backend POSTs to the user's configured ntfy server and topic. Supports self-hosted instances with optional auth tokens.
- **User setup:** User provides their ntfy server URL in Settings. Supports three URL formats:
  - `https://ntfy.sh` — uses public server, auto-generated topic `cfb-pickem-{userId}`
  - `https://ntfy.example.com/my-topic` — custom server and topic, no auth
  - `https://:TOKEN@ntfy.example.com/my-topic` — token auth (Bearer)
  - `https://USER:TOKEN@ntfy.example.com/my-topic` — basic auth
- **Cost:** Free (public ntfy.sh) or self-hosted.
- **Pros:** Privacy-friendly, self-hostable, simple API.
- **Cons:** Niche — requires users to know what ntfy is and set it up.

---

## Candidates

### Telegram Bot
- **How it works:** Create a bot via BotFather. User starts a chat with the bot to get their chat ID. Backend POSTs to `https://api.telegram.org/bot{TOKEN}/sendMessage` with the chat ID and message.
- **User setup:** User stores their Telegram chat ID in Settings (similar to ntfy URL today).
- **Cost:** Free.
- **Pros:** Widely used, simple REST API, reliable delivery, no self-hosting. Very similar implementation to ntfy.
- **Cons:** Requires a Telegram account. Chat ID discovery is slightly awkward (user must message the bot first).
- **Implementation complexity:** Low. One new sender module, one new DB column.

### Discord
- **How it works (webhook):** Admin creates a webhook URL for a channel. Backend POSTs to it. Shared channel, not per-user.
- **How it works (bot + DMs):** Bot DMs individual users. User provides their Discord user ID in Settings. More useful for per-user notifications.
- **User setup (webhook):** No user setup — admin configures one webhook URL in env vars.
- **User setup (bot DMs):** User stores their Discord user ID in Settings after joining the bot's server.
- **Cost:** Free.
- **Pros:** CFB audience overlaps heavily with Discord. A shared channel webhook is nearly zero implementation effort.
- **Cons:** Webhook approach is broadcast-only, not per-user. Bot DM approach requires users to share a server with the bot.
- **Implementation complexity:** Low (webhook) to Medium (bot DMs).

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

### Gotify
- **How it works:** Self-hosted push notification server. User creates an app token on their Gotify instance. Backend POSTs to `https://gotify.example.com/message` with the token.
- **User setup:** Same pattern as ntfy — user provides their Gotify server URL and token in Settings.
- **Cost:** Free, self-hosted.
- **Pros:** Self-hostable, open source.
- **Cons:** Overlaps heavily with ntfy. Smaller user base than ntfy. Redundant to support both unless specifically requested.
- **Implementation complexity:** Low (nearly identical to ntfy).

### SMS (Twilio / AWS SNS)
- **How it works:** Backend sends SMS via a third-party API using the user's phone number.
- **User setup:** User provides a verified phone number.
- **Cost:** Per-message cost (Twilio: ~$0.0079/SMS in the US). Adds up at scale.
- **Pros:** High visibility — SMS open rates are very high. No app required.
- **Cons:** Ongoing cost. Requires phone number collection and verification. Overkill for a pick'em game.
- **Implementation complexity:** Medium (plus phone verification flow).

---

## Summary

| Channel     | Cost       | User Effort | Impl. Complexity | Recommended |
|-------------|------------|-------------|------------------|-------------|
| Email       | Low        | None        | Done             | Yes (done)  |
| NTFY        | Free       | Medium      | Done             | Yes (done)  |
| Telegram    | Free       | Low         | Low              | Yes         |
| Discord     | Free       | Low–Medium  | Low–Medium       | Yes         |
| Pushover    | $5/user    | Low         | Low              | Maybe       |
| Web Push    | Free       | None        | High             | Maybe       |
| Gotify      | Free       | Medium      | Low              | No (ntfy overlap) |
| SMS         | Per-msg    | Low         | Medium           | No          |
