# Project Backlog

> Generated: 2026-03-26 | Last reviewed: 2026-06-04
> Focus: Full audit

---

## Security

### High
- **#26 [packages/backend/src/db/dbNotificationFunctions.ts]**: Email verification tokens never expire. `markEmailVerified` accepts any non-null token with no time check. A leaked token (e.g., server log, browser history, referrer header) can verify an email permanently. Fix: add `AND email_verification_sent_at > NOW() - INTERVAL '24 hours'` to the WHERE clause in Drizzle.
- **#27 [packages/backend/src/routes/user.ts:226-237]**: `GET /api/user/notifications/channels` requires auth but does not check league membership for the provided `leagueId`. Any authenticated user can pass any `leagueId` and receive its `ntfyTopicUrl`, `telegramInviteUrl`, and `discordInviteUrl`. Fix: add `requireLeagueMembership()` middleware to this route.
- **#28 [packages/backend/src/routes/auth.ts:138-144]**: `DELETE /api/auth/deleteUser` does not check if the user is the sole admin of any league before deleting. Self-deleting the last admin orphans the league permanently. Fix: before deletion, query league admin counts and return a 409 if the user is the sole admin of any league.
- **#29 [packages/backend/src/utils/zValidate.ts:160-167]**: `leagueChannelBodySchema` applies no URL format validation to `ntfyTopicUrl`, `telegramInviteUrl`, `discordWebhookUrl`, or `discordInviteUrl`. The Discord webhook URL is used server-side — a league admin can point it to an internal hostname (SSRF). Fix: apply `z.string().url()` to all URL fields in the schema.

### Medium
- **#30 [packages/backend/src/routes/leagues.ts:106-112]**: The `GET /api/leagues/invite/:inviteCode` route is unauthenticated and uses a 4-byte (32-bit) invite code (~4 billion combinations). Sustained brute-force is practical and leaks league names. Fix: increase to at least 8 bytes (`randomBytes(8)`) for a 64-bit code space.

### Low
_None identified._

---

## Bugs

### High
_None identified._

### Medium
- **#31 [packages/backend/src/db/dbAdminFunctions.ts:253-298]**: `addGameToLeague` relies on catching a DB constraint violation to return a 409 rather than preventing the conflict. Two concurrent add-requests for the same game both pass the existence check, then one hits the PK constraint. Fix: use `INSERT ... ON CONFLICT DO NOTHING` on the add path and check rows affected on the remove path.
- **#32 [packages/backend/src/routes/user.ts:155-210]**: `POST /api/user/picks` has no upper-bound check on the `userPicks.games` array. A large array passes Zod validation and runs per-game DB lookups for every element. Fix: add `.max(50)` to the Zod array schema.
- **#33 [packages/frontend/src/pages/Settings.tsx:57]**: Frontend password schema enforces `max(72)` but the backend enforces `max(128)`. A user who sets a 73–128 char password via direct API call cannot change it through the UI. Fix: align frontend to `max(128)`.

### Low
- **#34 [packages/backend/src/routes/leagues.ts:282]**: `dispatchLeagueBroadcast` failure is caught with `console.error` — the only `console.error` in production application code. Fix: replace with `logger.error({ err, leagueId }, 'dispatchLeagueBroadcast failed')`.
- **#35 [packages/backend/src/db/dbLeagueFunctions.ts:158-167]**: `removeMember` silently returns success if the member was already removed (e.g., two admins act concurrently). Fix: check rows affected and return 404 if 0 rows were deleted.
- **#36 [packages/backend/src/routes/admin.ts:78-93]**: `POST /admin/year/:year` propagates a raw DB constraint error as a 500 if the year already exists (duplicate PK). Fix: catch the constraint violation and return a 409.
- **#37 [packages/backend/src/routes/auth.ts:81]**: Verification email URL hardcodes `clientURLs[0]`. If `CLIENT_URL` has multiple values and order changes, email links silently break. Low risk at current scale, but the environment docs should state that the first `CLIENT_URL` value is used for email links.

---

## Performance

### High
_None identified._

### Medium
- **#8 [packages/backend/src/notifications/dispatcher.ts:54-77]**: Emails are sent sequentially in a `for` loop. At small user counts this is fine, but slow SMTP holds the event loop open for all sends. Fix (when needed): convert to `Promise.allSettled` with per-user catch blocks.
- **#38 [packages/backend/src/routes/admin.ts:199-249]**: `sync-results` and `correct-score` run a sequential `for...of` loop with a DB query per league, blocking the response before `waitUntil` is called. Fix: replace with `Promise.all(activeLeagues.map(...))` for the per-league fetches.
- **#39 [packages/backend/src/cron/cronTick.ts:90-101]**: `getGamesForLeagueWeek` is called sequentially per league in the cron loop. Fix: use `Promise.all` to parallelize all per-league DB fetches.

### Low
- **#40 [packages/backend/src/routes/leagues.ts:114-129]**: `GET /:leagueId` fetches the league twice — once inside `requireLeagueMembership()` and once in the handler via `getLeagueById`. Fix: store the league row in Hono context inside `requireLeagueMembership` and read it in the handler.
- **#41 [packages/backend/src/notifications/emailSender.ts:18]**: A new `Resend` instance is created on every `sendEmail` call. Fix: initialize the `Resend` client once at module scope and reuse it.

---

## Improvements & Refactors

### High
_None identified._

### Medium
- **#42 [packages/frontend/src/components/LeagueSettingsSection.tsx]**: This component handles member list display, role mutations, invite code management, league rename, notification channel config (6 fields), and broadcast sending — 5+ distinct responsibilities with 13+ state variables. Fix: extract `LeagueChannelsForm.tsx`, `LeagueBroadcastForm.tsx`, and `LeagueMembersTable.tsx` as focused components.

### Low
- **#43 [packages/backend/src/db/dbUserFunctions.ts]**: `addPickedGame` (single-pick variant) appears unused — all pick submission goes through `addPickedGamesBatch`. Verify and remove if confirmed dead code.
- **#44 [packages/backend/src/db/dbUserFunctions.ts]**: `userId` is typed as `string` in pick-related DB functions (`addPickedGame`, `addPickedGamesBatch`, `returnUserGames`, `returnUserPickHistory`) but as `number` everywhere else in the same file. Fix: standardize on `number` and convert at the route layer.

---

## Feature Ideas

### High
_None identified._

### Medium
- **#22 [packages/backend/src/db/dbUserFunctions.ts, packages/backend/src/routes/user.ts]**: `GET /user/history` endpoint and `returnUserPickHistory()` DB function already exist, but there is no frontend UI to browse full pick history. Create a `PickHistoryView.tsx` component with season/week/outcome filters, surfaced as a new Dashboard tab or collapsible section.
- **#24 [packages/backend/src/cron/cronTick.ts, packages/backend/src/notifications/]**: No admin-configurable "picks open" reminder exists. The end-of-week standings digest fires automatically via `rankings_updated`. The missing piece is a weekly reminder at a configurable day/time: (1) if games are curated, send the picks-open reminder to all users; (2) if no games exist yet, send an admin-only notification to prompt curation — `games_ready` only fires after curation, so a forgetful admin gets no nudge. Would require a `scheduled_notifications` DB table or stored cron schedule; reuses existing `dispatcher.ts` and `templates.ts`.

### Low
- **#25 [packages/frontend/src/apis/authRequests.ts:63]**: `DELETE /api/auth/deleteUser` route and `deleteUser()` frontend API function both exist, but no UI surfaces them. Add an "Account Management" section in Settings that calls `deleteUser()` with a confirmation dialog.

---

## Summary

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| Security | 4 | 1 | 0 | 5 |
| Bugs | 0 | 3 | 4 | 7 |
| Performance | 0 | 3 | 2 | 5 |
| Improvements & Refactors | 0 | 1 | 2 | 3 |
| Feature Ideas | 0 | 2 | 1 | 3 |
| **Total** | **4** | **10** | **9** | **23** |
