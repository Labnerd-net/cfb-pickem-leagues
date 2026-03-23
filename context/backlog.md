# Project Backlog

> Generated: 2026-03-14
> Focus: Full audit
> Last updated: 2026-03-23 — closed [20], [21] (leaderboard cache, external API cache — not warranted at target scale of ~15 users); completed [1], [4], [5], [6] (security fixes); completed [9] (picks transaction), closed [12] (false positive); completed [10], [11], [17] (cron week reset, settings error handling, email transporter singleton); completed [2], [3] (email XSS escape, rate limiter TRUST_PROXY); completed [7], [8] (DB connection options, admin bootstrap fix); completed [13], [14] (ErrorBoundary hookup, addGameToWeek removal); completed [15], [19] (picks N+1 bulk fetch, startTime index); completed [16], [18] (notification bulk query, rate limiter interval cleanup); completed [22], [26], [32] (week query-param validation refactor, weekNumber rename, schema consolidation); completed [25] (Hono RPC type cast removal); completed [23], [24] (AdminSection and WeekGameSection component refactor); completed [27] (pick voided status, FK cascade → restrict); completed [28], [30], [31], [33] (notification log pagination, email timezone, tab index refactor, env var Zod validation); completed [53] (notification log server-side filtering); completed [52] (CFBD-only data source, spread support); completed [35] (user profile update — display name and password change); completed [54] (delete year data — admin reset UI); completed [39] (admin score correction with audit log)

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
_None identified._

---

## Improvements & Refactors

### High
_None identified._

### Medium
_None identified._

### Low
_None identified._

---

## Feature Ideas

### High
- **[34]** **[packages/frontend/src/components/user/LeaderboardSection.tsx]**: Week-level leaderboard exists at `GET /leaderboard/scores` but the UI has no week selector — only season standings are shown. Wire up the existing endpoint with a week dropdown.

### Medium
- **[36]** **[packages/frontend/src/components/user/UserPicksGameCard.tsx]**: Deadline UX is minimal — locked games show generic message with no advance warning. Add: countdown timer to lockdown, visual lock indicators on cards before deadline, pre-submit validation showing which picks will be rejected.
- **[37]** **[packages/backend/src/db/dbUserFunctions.ts:179]** + **[packages/frontend/src/apis/userRequests.ts]**: `GET /user/picks/history` exists in the backend but the UI doesn't expose a full pick history browser. Build a filterable history view (by week, outcome, team).
- **[38]** **[packages/frontend/src/components/admin/UsersSection.tsx]**: Admin user management is single-user only. Add bulk operations: bulk role assignment, CSV export of user + pick data, bulk notification send.
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
| Performance | 0 | 0 | 0 | 0 |
| Improvements & Refactors | 0 | 0 | 0 | 0 |
| Feature Ideas | 1 | 5 | 10 | 16 |
| **Total** | **1** | **5** | **10** | **16** |
