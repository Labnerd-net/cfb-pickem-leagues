# Project Backlog

> Generated: 2026-03-14
> Focus: Full audit
> Last updated: 2026-03-16 — completed [1], [4], [5], [6] (security fixes); admin log viewer UI shipped (partially addresses [28]); completed [9] (picks transaction), closed [12] (false positive); completed [10], [11], [17] (cron week reset, settings error handling, email transporter singleton)

---

## Security

### High
- **[2]** **[packages/backend/src/notifications/templates.ts:74,83]**: `rankingsUpdatedTemplate` interpolates `e.displayName` directly into an HTML table: `` `<td>${e.displayName}</td>` ``. A display name containing `<script>...` will be embedded raw into the email HTML sent to all opted-in users. Fix: HTML-escape all user-supplied strings before embedding in `htmlBody` (replace `&`, `<`, `>`, `"`, `'` with entities, or use the `he` library).
- **[3]** **[packages/backend/src/utils/rateLimiter.ts:44-49]**: `x-forwarded-for` is trusted unconditionally. A client can spoof this header to share a rate-limit bucket with any IP or escape their own. Fix: only trust the header from known proxy IPs, or use the socket remote address exclusively.

### Medium
- **[7]** **[packages/backend/src/db/index.ts:14]**: DB connection string assembled via string interpolation. A password with URL-special characters (`@`, `/`, `#`) silently malforms the URL. Fix: pass individual `host/user/password/database` options to Drizzle instead of a connection string.
- **[8]** **[packages/backend/src/routes/auth.ts:63-64]**: The first registered user is auto-promoted to admin. `returnUsers()` counts only active users, not soft-deleted ones. If the sole admin deletes their account, the next registrant becomes admin. Fix: document the intent; if unintentional, include `deleted_users` in the count or add a separate admin promotion flow.

### Low
_None identified._

---

## Bugs

### High
_None identified._

### Medium
_None identified._

### Low
- **[13]** **[packages/frontend/src/components/ErrorBoundary.tsx]**: `ErrorBoundary` component is defined but never used in `App.tsx`. Render errors from any route component are uncaught. Fix: wrap `<BrowserRouter>` or `<AuthProvider>` in `<ErrorBoundary>`.
- **[14]** **[packages/backend/src/db/dbAdminFunctions.ts:96-126]**: `addGameToWeek` appears to be dead code — all routes and cron use `upsertGameForWeek` exclusively. Fix: verify and remove to avoid confusion.

---

## Performance

### High
- **[15]** **[packages/backend/src/routes/user.ts:111-129]** + **[packages/backend/src/db/dbUserFunctions.ts:150-153]**: Two layers of N+1 on picks submission. First, `user.ts` calls `returnGame(pick.game)` sequentially in a `for` loop (one query per pick). Second, `addPickedGame` calls `returnGame` again for every pick. 10 games = 20 SELECT queries before any INSERT. Fix: bulk-fetch all submitted game IDs with a single `WHERE game_id = ANY(...)` query before the loop; remove the redundant fetch inside `addPickedGame`.

### Medium
- **[16]** **[packages/backend/src/notifications/dispatcher.ts:55]** + **[packages/backend/src/db/dbNotificationFunctions.ts:96-133]**: `hasNotificationBeenSent` is called per-user in a sequential loop — 50 users = 50 queries per notification event. Fix: bulk-fetch already-sent log entries for the `(year, weekNumber, notificationType, channel)` tuple; build a userId Set; one query replaces N.
- **[18]** **[packages/backend/src/utils/rateLimiter.ts:14-17]**: The cleanup `setInterval` is registered at module load and never cleared. Prevents graceful shutdown and leaks the interval across test suites. Fix: export a `clearRateLimitStore()` function that calls `clearInterval` for use in tests and shutdown hooks.
- **[19]** **[packages/backend/src/db/schema/admin.ts:43]**: No index on `games.startTime`. Deadline enforcement in `user.ts` and cron refresh query this column. Fix: add `index('games_start_time_idx').on(table.startTime)`.

### Low
- **[20]** **[packages/backend/src/db/dbUserFunctions.ts:217]**: Leaderboard query joins all user picks and groups by user — O(all_picks) complexity. Will degrade noticeably at scale (10K+ users, 100+ weeks). Fix: consider materialized view or short-lived cache invalidated on new picks/score updates.
- **[21]** **[packages/backend/src/api/index.ts:63]**: External data source (NCAA/CFBD/SportsDataverse) is queried on every admin request with no caching. Fix: in-memory or Redis cache with TTL for game metadata.

---

## Improvements & Refactors

### High
- **[22]** **[packages/backend/src/routes/*.ts]**: Week identifier validation (`isNaN(year)`, `year < 1900`, etc.) is duplicated across `user.ts`, `leaderboard.ts`, and `admin.ts`. Fix: extract to a reusable Zod schema or validator in `zValidate.ts`.

### Medium
- **[23]** **[packages/frontend/src/components/admin/AdminSection.tsx]**: 369 lines, 9 state variables, 7 async handlers — handles week loading, game loading, import, selection, and all state. Fix: extract into `useWeekManagement` and `useGameManagement` hooks; the JSX would drop to ~100 lines.
- **[24]** **[packages/frontend/src/components/user/WeekGameSection.tsx]**: 305 lines, 10 state variables, 3 `useEffect` hooks, renders both picks-mode and results-mode. Fix: move data-fetching logic into a `useWeekGames` hook; split picks/results render into separate components.
- **[25]** **[packages/frontend/src/apis/userRequests.ts:48,70,92,112,151,177]**: Multiple API functions cast response bodies with `as unknown as SomeType`, defeating the end-to-end type safety the Hono RPC client is supposed to provide. Fix: align frontend type definitions with actual response shapes so the casts are unnecessary.
- **[26]** **[packages/backend/src/routes/admin.ts]** vs **[packages/backend/src/routes/user.ts]**: Inconsistent week parameter naming (`week` vs `weekNumber`) across endpoints causes confusion. Fix: standardize all endpoints to `weekNumber`.
- **[27]** **[packages/backend/src/db/schema/users.ts:52-56]**: `user.games` foreign key to `admin.games` uses `.onDelete('cascade')`. If an admin game is ever deleted, all user picks for it silently vanish. Fix: consider soft deletes or a "pick voided" status to maintain audit trail.

### Low
- **[28]** **[packages/backend/src/routes/admin.ts:169]** + **[packages/frontend/src/components/admin/NotificationLogSection.tsx:50]**: Notification log limit is hardcoded at 500 with no pagination — a silent data truncation for self-hosters running multiple seasons. Fix: add `limit`/`offset` query params to `GET /admin/notification-logs` and paginate the UI. Add a code comment at the hardcap explaining the limitation. _(UI shipped 2026-03-16; pagination still needed)_
- **[29]** **[packages/backend/src/routes/leaderboard.ts:14]**: `GET /leaderboard` returns all users on every request with no pagination. Only relevant at meaningful scale (50+ users). Fix: add `?limit=50&offset=0` query params.
- **[30]** **[packages/backend/src/notifications/templates.ts:30-36]**: `toLocaleString` called without an explicit timezone — kickoff times in reminder emails reflect server timezone, not anything meaningful to recipients. Fix: pass `{ timeZone: 'America/New_York' }` or use UTC with explicit label.
- **[31]** **[packages/frontend/src/pages/Dashboard.tsx:68-78]**: Tab-to-component mapping uses sequential `currentTab === N` ternaries. Inserting a new tab shifts all subsequent indices. Fix: use an array of `{ label, icon, component }` objects indexed by tab value.
- **[32]** **[packages/backend/src/utils/zValidate.ts]**: Zod schemas scattered — some in `zValidate.ts`, others inline in route files. Fix: consolidate all request schemas into `zValidate.ts` for discoverability.
- **[33]** **[packages/backend/src/utils/envVars.js]**: Environment variables validated lazily at runtime when first accessed. Fix: validate all required env vars at startup via Zod and fail fast with a clear error message.

---

## Feature Ideas

### High
- **[34]** **[packages/frontend/src/components/user/LeaderboardSection.tsx]**: Week-level leaderboard exists at `GET /leaderboard/scores` but the UI has no week selector — only season standings are shown. Wire up the existing endpoint with a week dropdown.
- **[35]** **[packages/backend/src/routes/user.ts]**: No endpoint for updating user profile. Users can't change display name or password after registration. Add `PATCH /user/profile` with display name and password change support.

### Medium
- **[36]** **[packages/frontend/src/components/user/UserPicksGameCard.tsx]**: Deadline UX is minimal — locked games show generic message with no advance warning. Add: countdown timer to lockdown, visual lock indicators on cards before deadline, pre-submit validation showing which picks will be rejected.
- **[37]** **[packages/backend/src/db/dbUserFunctions.ts:179]** + **[packages/frontend/src/apis/userRequests.ts]**: `GET /user/picks/history` exists in the backend but the UI doesn't expose a full pick history browser. Build a filterable history view (by week, outcome, team).
- **[38]** **[packages/frontend/src/components/admin/UsersSection.tsx]**: Admin user management is single-user only. Add bulk operations: bulk role assignment, CSV export of user + pick data, bulk notification send.
- **[39]** **[packages/backend/src/db/dbAdminFunctions.ts:286]**: `markGameComplete()` is dev-only. There's no admin UI to manually override a game score when the external API returns wrong data. Add a score correction interface with audit trail.
- **[40]** **[packages/frontend/src/components/user/WeekGameSection.tsx]** + **[packages/frontend/src/components/user/LeaderboardSection.tsx]**: Several views have no empty states — blank space renders for "no games", "no picks", or "season not started". Add meaningful placeholder content.
- **[41]** **[packages/backend/src/notifications/dispatcher.ts]**: Notifications are event-driven only. Add scheduled/recurring notifications (weekly picks reminder at fixed time, season summary) configurable by admin.

### Low
- **[42]** **AI: Pick recommendations** — before the deadline, expose a per-game analysis endpoint that prompts an LLM with recent form, spread, and rankings context. Surface it as an optional "breakdown" on each game card in `UserPicksGameCard.tsx`. User still makes the pick manually. Requires an AI API key (e.g. Claude API); negligible cost at <20 users.
- **[43]** **AI: Weekly recap narrative** — after scores finalize, generate a short personalized summary per user ("You went 7-3, nailed the Auburn upset...") via cron or on-demand. Pick history data already exists in `GET /user/picks/history`. Render in a new section on the Dashboard or as a notification.
- **[44]** **AI: Season summary** — end-of-season narrative per user derived from full-season pick history. One-time generation per user per season. Low ongoing cost, no schema changes required.
- **[45]** Head-to-head competition mode — users challenge each other for a specific week; H2H records tracked.
- **[46]** Confidence/point-based picks — users assign strength levels; leaderboard sorts by points rather than win count. Requires schema extension to `user.games`.
- **[47]** Weekly stat breakdowns — hot/cold streaks, most upsets picked, accuracy by game type.
- **[48]** Mobile push notifications — extend the existing sender pattern in `packages/backend/src/notifications/` to support FCM/APNs.
- **[49]** In-app discussion threads — per-game or per-week comments. Would require new tables and potentially WebSocket support.
- **[50]** Season/competition templates — pre-built seasons, clone weeks from prior year. Builds on `POST /admin/year/:year` and `handleImportWeeks()`.
- **[51]** Team-based leagues — users create private leagues with their own leaderboards. Significant schema work.

---

## Summary

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| Security | 2 | 2 | 0 | 4 |
| Bugs | 0 | 0 | 2 | 2 |
| Performance | 1 | 3 | 2 | 6 |
| Improvements & Refactors | 1 | 5 | 6 | 12 |
| Feature Ideas | 2 | 6 | 10 | 18 |
| **Total** | **6** | **16** | **20** | **42** |
