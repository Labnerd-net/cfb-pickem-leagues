# Project Backlog

> Generated: 2026-11-03
> Focus: Full audit
> Security findings are tracked separately in context/backlog-security.md (gitignored).
> Numbering is shared across both files. Findings come from a read-through audit; none were reproduced by running code, so confirm before fixing.

---

## Bugs

### High
- **#15 [cron/cronTick.ts ~L113 vs routes/admin.ts L127-135, L169-173]**: Cron refresh calls `getGameData({year, week: weekNumber, seasonType})` without the `cfbdWeek` offset that the admin routes compute (`weekNumber - getMaxRegularWeek`). For postseason weeks CFBD returns an empty list, nothing is upserted, and `lastRefreshAt` is still set, so bowl results and `rankings_updated` never fire without a manual Sync Results. Fix: extract the postseason-offset logic into one helper used by `admin.ts` and `cronTick.ts`; log a warning on an empty result.
- **#16 [cron/cronTick.ts L113-116, db/dbAdminFunctions.ts `upsertGamesForWeek` L102-153, routes/admin.ts `POST /admin/week` L145]**: Cron refresh and week re-import overwrite `completed`, scores, and `winningTeam` on conflict without honoring `getCorrectedCfbdGameIds`; only `sync-results` filters corrected games. A manually corrected score is silently replaced by CFBD's value on the next tick. Fix: apply the corrected-games filter inside `upsertGamesForWeek` so every caller gets it.
- **#17 [cron/cronTick.ts L145-179, worker.ts L26-30]**: Notification dispatches are fire-and-forget inside the Workers `scheduled` handler (no `ctx.waitUntil`, `_ctx` was removed in the lint fix), and the in-memory sent-flags are set before the send. Invocation end can cancel pending sends, and the flags then block retries for that isolate; a missed 15-minute tick can mean a missed reminder window. Fix: await `Promise.allSettled` on the dispatches (or pass `ctx` and use `waitUntil`) and set the flags only after dispatch resolves.
- **#18 [utils/zValidate.ts L52, user/usePickSubmit.ts L106-108]**: `POST /user/picks` caps `games` at 50 while the frontend resubmits every pick for the week and an FBS week is ~60-70 games. A league pooling a full week gets a 400 on every save. Fix: raise the cap to ~150 and/or send only changed picks (also reduces DB writes).
- **#19 [routes/admin.ts L97-107, db/dbAdminFunctions.ts L499-520]**: "Reset Year" 500s when any league pool contains games from that year: `league_games.game_id` FKs to `admin.games` with `ON DELETE no action`, and `hasPicksForYear` only checks `user.games`. The games and weeks deletes are also separate, non-atomic statements. Fix: delete `league_games` for the year first, then games, then weeks in one `db.batch`, or add `ON DELETE CASCADE` via migration.

### Medium
- **#20 [routes/auth.ts L56/L105, db/dbUserFunctions.ts L87, schema/users.ts L26]**: Emails are not trimmed or lowercased and the unique constraint is case-sensitive, so `Bob@x.com` and `bob@x.com` become separate accounts and logins with different casing fail. Fix: `.trim().toLowerCase()` in the register/login schemas, plus a migration to normalize existing rows and add a unique index on `lower(email)`.
- **#21 [db/dbUserFunctions.ts L352-395 `returnWeekScores`]**: Weekly scores do not join `league_members`, and `removeMember` does not delete the member's picks, so removed members still appear in weekly standings and inflate the participation baseline in `rankLeaderboard`; season and weekly boards disagree. Fix: inner-join `league_members` on `(userId, leagueId)`.
- **#22 [routes/auth.ts L128-137/L155-160, VerifyEmail.tsx]**: `/auth/me` reads `emailVerified` from the JWT while `/verify-email` updates only the DB, so the auth context shows unverified until the next login or profile update (Settings reads from the DB, limiting impact). Fix: have `/me` read from the DB; see security backlog #1.
- **#23 [routes/admin.ts L92]**: `Promise.all(addWeek)` fans out one HTTP request per week against Neon and is non-atomic; a partial failure leaves a half-loaded year that returns 409 "Year already loaded" on retry. Fix: add an `addWeeks(weeks[])` multi-row `INSERT ... ON CONFLICT DO NOTHING`.

### Low
- **#24 [notifications/dispatcher.ts]**: Dedupe is check, send, then log, so concurrent triggers (cron plus an admin Sync Results click) can double-send. Fix: insert the log row first with `ON CONFLICT DO NOTHING ... RETURNING` and send only if inserted.
- **#25 [notifications/telegramSender.ts L23, discordSender.ts L21]**: Telegram uses `parse_mode: 'Markdown'` with unescaped text, so titles containing `_`, `*`, or backticks (league names) cause a 400 and a silently dropped message; Discord payloads do not set `allowed_mentions`. Fix: escape or send plain text; set `allowed_mentions: { parse: [] }`.
- **#26 [db/dbLeagueFunctions.ts L13-25, routes/auth.ts L72-74]**: `createLeague` does two non-atomic inserts; a failure on the second leaves a league with no admin (and a stuck first user on bootstrap). Fix: `db.batch` or a single CTE.
- **#27 [db/dbAdminFunctions.ts L422-437 `correctGameScore`]**: The old values are read in an earlier request and the update and audit insert are separate statements, so concurrent edits can audit the wrong "old" score and a failed audit insert leaves an unaudited correction. Fix: `db.batch` both writes.
- **#28 [routes/admin.ts L230-232, dbAdminFunctions.ts L424]**: A tied corrected score sets `completed: true` with `winningTeam: 'pending'`; code treating `pending` as unfinished disagrees with `isWeekComplete`. Confirm intent and handle ties explicitly.
- **#29 [db/dbAdminFunctions.ts L137-147]**: `upsertGamesForWeek` does not update `cfbdGameId` on conflict, so seeded rows never get one (no ESPN link, no correction protection). Fix: add `cfbdGameId` to the `set` list.
- **#30 [routes/leagues.ts L158-163, L189-194, L88-94]**: Last-admin check and join-existence check are read-then-write; concurrent demotions can leave zero admins and a double join returns 500 on the PK. Fix: single conditional statement, or catch the unique-violation code.
- **#31 [useWeekNavigation.ts L23, usePickSubmit.ts L32, LeaderboardSection.tsx L28]**: `activeLeague?.leagueId ?? 1` is a leftover Phase 4 shim that silently uses league 1. Fix: remove the default and return early when `activeLeague` is null.
- **#32 [LeaderboardSection.tsx L48-61, LeagueChannelsForm.tsx L22-28, Settings.tsx L118-137, useWeekNavigation.ts L137]**: Season-view effect lacks the `cancelled` stale-request guard; `getLeagueChannels().then` has no `.catch` (spinner can hang); preference toggle updates local state even when the API call fails; an error filter matches a message no route returns. Fix each individually.
- **#33 [index.ts L28-38, routes/auth.ts L82/L166]**: CORS `origin` captures `clientURLs` at module load while `reinitializeSecrets` reassigns it; `CLIENT_URL.split(',')` does not trim; an unset `CLIENT_URL` in prod yields `localhost` links in verification emails. Fix: pass a function to `origin`, trim, and fail fast in production.
- **#34 [routes/auth.ts L155]**: `GET /auth/verify-email` mutates state, so email scanners that prefetch links can consume the token. Fix: make the backend route POST (the SPA already calls it after load).

---

## Performance

### High
_None identified._

### Medium
- **#35 [notifications/dispatcher.ts L60-78, L217-233, L265-281]** (plan-dependent, unverified): Each recipient costs at least two subrequests (Resend send plus Neon `addNotificationLog`) through unbounded `Promise.allSettled`, which can hit Workers subrequest limits (50 on the free plan) and conflicts with the Neon fan-out guidance. Fix: send in chunks of ~10, use Resend's batch endpoint, and insert log rows in one multi-row statement.
- **#36 [routes/admin.ts L312]**: Platform admin broadcast is awaited inline across all users, so a large user base can time out the request while partially sent; a retry double-sends. Fix: use `waitUntil` as the league broadcast route does.

### Low
- **#37 [utils/middleware.ts L49-52, worker.ts L18, routes/user.ts `GET /user/games`]**: `getLeagueById` then `getLeagueMembership` run sequentially on every league route; `GET /user/games` chains `returnWeekByQuery` and the games query; `reinitializeSecrets` spreads `process.env` and re-parses the Zod schema on every request. Fix: `Promise.all` or a join, and memoize secrets parsing.
- **#38 [db schema: `user.games`, `league_members`]**: Missing indexes on `user.games(league_id, game_id)` and `league_members(user_id)` used by `getLeaguesForUser`, `deleteUserWithAudit`, `deleteLeague`; `returnUsers`, `returnUserPickTotals`, and `/admin/users/export` are unpaginated full scans. Minor at current scale.

---

## Improvements & Refactors

### High
- **#39 [.github/workflows/]**: Only the two Claude workflows exist; nothing runs lint, tsc, tests, or build on PRs, for a site with real users. Fix: add `ci.yml` (pnpm install `--frozen-lockfile`, `pnpm lint`, `tsc --noEmit` for backend and frontend, `pnpm test`, `pnpm build`). Tests use PGlite and MSW so no secrets are needed. Add a CI README badge once it passes.
- **#40 [backend/src/utils/leaderboardRanking.ts]**: Core scoring logic with no direct tests. Add `tests/unit/utils/leaderboardRanking.test.ts` covering the 50% threshold, `minRatio=0` for weekly, shared ranks on ties (1, 1, 3), secondary sort by correct then name, all-pending users with rank `null`, empty input, and zero max finished count.

### Medium
- **#41 [root and package package.json, CLAUDE.md]**: Type-checking is a manual `npx tsc` incantation. Add per-package and root `typecheck` scripts and an optional root `check` chaining lint, typecheck, test, build; reuse in CI.
- **#42 [frontend tests]**: Untested: `usePickSubmit`, `useWeekGames`, `useWeekNavigation`, `useGameManagement`, and components `LeagueAdminSection`, `UsersSection`, `NotificationLogSection`, `WeekResultsView`, `Dashboard`, `AdminSection`, `LeagueSettingsSection`, `LeagueMembersTable`, `LeagueChannelsForm`. Prioritize the pick hooks.
- **#43 [frontend a11y]**: Few `aria-*`/`alt` usages. Probable gaps: pick controls on `UserPicksGameCard`/`GameCard`, the live countdown (no `aria-live` handling), leaderboard table semantics, dialog labelling/focus return, color-only win/loss indicators, the "—" rank. Add `eslint-plugin-jsx-a11y` and axe checks in component tests.
- **#44 [frontend App.tsx, vite.config.ts]**: All pages import eagerly (no `React.lazy`, no `manualChunks`). Lazy-load `Dashboard`, `Settings`, and the admin/league-admin sections.
- **#45 [frontend LeaderboardSection, useWeekGames, UsersSection, NotificationLogSection]**: Six deferred `react-hooks/set-state-in-effect` lint warnings and repeated loading/error/cancelled boilerplate. Introduce a shared `useAsync` hook or adopt TanStack Query (also adds caching across tab/league switches).
- **#46 [AdminSection.tsx, LeagueAdminSection.tsx]**: Both compose `useWeekManagement`, `useGameManagement`, `WeekSelector`, and `GamesList` in parallel structure. Extract a shared curator container parameterized by scope to avoid fixes landing in only one panel.
- **#47 [db/dbAdminFunctions.ts (576 lines), dbUserFunctions.ts (499), dbNotificationFunctions.ts (374), dbLeagueFunctions.ts (303)]**: Split by domain (games, weeks, picks, leaderboard, history) and colocate the ranking input queries (`returnLeaderboard`, `returnWeekScores`) with `leaderboardRanking.ts`.
- **#48 [tests/routes/leaderboard.test.ts]**: Add route-level cases for percent ranking (qualification cutoff, voided picks, ties) so the DB aggregation and `rankLeaderboard` are verified together.
- **#49 [server.ts, worker.ts, `start:prod` script]**: Two runtime entry points; if production is the Worker, the Node path risks drifting. Document which is canonical or remove the unused path, and confirm `cronTick` behaves the same in both.

### Low
- **#50 [repo root]**: No pre-commit hook (husky/lint-staged). Lower priority than CI.
- **#51 [packages/backend/pnpm-lock.yaml, packages/frontend/pnpm-lock.yaml]**: Per-package lockfiles are tracked alongside the root lockfile; likely leftovers that can drift. Remove if unused.
- **#52 [backend api-responses/ncaa-api/*, tests/bruno NCAA/SDV collections, src/types/ncaa-api.ts, root `axios` dependency, packages/shared/types/cfb-pickem-api.js]**: NCAA/SDV sources were removed but fixtures and collections remain tracked; verify and delete dead types, the root `axios` dependency, and the compiled `.js` artifact beside the shared `.ts`.
- **#53 [TODO.md, context/backlog.md]**: TODO.md holds a stale password-minimum item (minimum is now 8). Refresh both.
- **#54 [vitest.config.ts]**: Coverage reporting exists; add thresholds or report in CI once CI exists.
- **#55 [ESLint config]**: The "no `Promise.all` fan-out in `src/db`" rule is a review convention only. Enforce with `no-restricted-syntax`.
- **#56 [Worker observability]**: No error aggregation. Enable Workers observability and log a per-run cron summary (games imported, notifications sent).
- **#57 [cron/cronTick.ts (181 lines)]**: Extend the pure-function split used in `cronLogic.ts` to the remaining branching in `cronTick.ts`.
- **#58 [Login.tsx L58-60, routes/admin.ts L280-282, index.ts L15-24, dbAdminFunctions `returnWeek`/`returnGame`, ntfySender L62, dbUserFunctions `returnUserByEmail`]**: Dead or stale code: unused `rememberMe` write, a stub `POST /admin/notifications/test`, local `KVNamespace`/`Fetcher` interfaces and a stale `RATE_LIMIT_KV` binding, likely-unused DB helpers; also remove PII and URLs from debug logs.
- **#59 [Settings.tsx (500+ lines), dispatcher.ts, user.ts/leaderboard.ts validators, route `Variables` types, frontend inline `sx` fonts]**: Split `Settings.tsx` into sections plus a data hook; extract a `sendToChannels` helper for the repeated per-channel send-and-log blocks; use `c.req.valid('query')` instead of re-parsing `c.req.query`; share the Hono `Variables` type; move repeated typography to the theme.

---

## Feature Ideas

### High
_None identified._

### Medium
- **#60 [frontend, `GET /user/history`, `getUserPickHistory()`]**: Backend and the API function exist but no component calls them. Add a Pick History Dashboard tab with season/week/outcome filters.
- **#61 [backend picks aggregate, frontend game cards]**: After a game starts, show each league member's pick and the percentage split per game. Needs one aggregate query; gate strictly to post-kickoff.
- **#62 [cron, admin notifications]**: Admin nudge when no games have been curated by a set day of the week (builds on the existing `picks_reminder_24h` and dispatcher). Carried over from the earlier backlog.

### Low
- **#63 [LeaderboardSection, `returnWeekScores`/`returnLeaderboard`]**: Streaks, best week, "perfect week" badge, and a weekly rank sparkline, derived from existing data.
- **#64 [UserPicksGameCard.tsx, `AdminGameData.spread`]**: The CFBD spread is stored but not shown on user-facing views. Show it on the pick card.
- **#65 [leagues routes, invite flow]**: Public read-only standings page or share-image card per league.
- **#66 [league settings, ranking]**: Optional league-level tiebreaker pick (e.g. total points of the final game). Schema and UI change; only if ties are a real complaint.
- **#67 [context/specs/league-member-ads.md]**: League-member business ads (current in-progress feature). Heaviest new infrastructure (new Cloudflare D1 binding) for a niche benefit; keep isolated as the spec says.
- **#68 [frontend]**: PWA manifest and service worker with an "Add to Home Screen" prompt for mobile.
- **#69 [context/research/sport-expansion-apis.md]**: Other sports; the schema is football-centric (weeks, `seasonType`), so keep as research only.

---

## Summary

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| Bugs | 5 | 4 | 11 | 20 |
| Performance | 0 | 2 | 2 | 4 |
| Improvements & Refactors | 2 | 9 | 10 | 21 |
| Feature Ideas | 0 | 3 | 7 | 10 |
| **Total** | 7 | 18 | 30 | 55 |
