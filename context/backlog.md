# Project Backlog

> Generated: 2026-03-14
> Focus: Full audit
> Last updated: 2026-03-18 — completed [1], [4], [5], [6] (security fixes); admin log viewer UI shipped (partially addresses [28]); completed [9] (picks transaction), closed [12] (false positive); completed [10], [11], [17] (cron week reset, settings error handling, email transporter singleton); completed [2], [3] (email XSS escape, rate limiter TRUST_PROXY); completed [7], [8] (DB connection options, admin bootstrap fix); completed [13], [14] (ErrorBoundary hookup, addGameToWeek removal); completed [15], [19] (picks N+1 bulk fetch, startTime index); completed [16], [18] (notification bulk query, rate limiter interval cleanup)

---

## Security

### High
_None identified._

### Medium
_None identified._

### Low
_None identified._

---

## Bugs

### High
_None identified._

### Medium
_None identified._

### Low
_None identified._

---

## Performance

### High
_None identified._

### Medium
_None identified._

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
| Security | 0 | 0 | 0 | 0 |
| Bugs | 0 | 0 | 0 | 0 |
| Performance | 0 | 1 | 2 | 3 |
| Improvements & Refactors | 1 | 5 | 6 | 12 |
| Feature Ideas | 2 | 6 | 10 | 18 |
| **Total** | **1** | **12** | **18** | **31** |
