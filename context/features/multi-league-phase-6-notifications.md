# Plan: Multi-League Phase 6 — League-Scoped Notifications

## Context

Before this phase, the notification dispatcher fetched all site users globally — marking games complete in League A sent emails to every opted-in user on the site, regardless of league membership. The `notification_log` unique key didn't include `league_id`, so a user receiving a "Week N complete" notification in League A would be deduped as already-sent if League B tried to notify them for the same week.

Phase 6 makes every game-complete and picks-reminder notification league-aware: only members of the triggering league receive it, and a user in multiple leagues gets one notification per league.

**Status:** Implementation is substantially complete on this branch. The plan covers remaining verification and any gaps.

---

## What Has Been Implemented

### 1. Schema & Migration (`packages/backend`)
- `users.ts` schema: `notification_log` gains `league_id INTEGER NOT NULL`; unique constraint updated to `(user_id, league_id, year, week_number, notification_type, channel)`
- Migration: `drizzle/0009_young_meltdown.sql` — adds nullable column, backfills (`user_id=0 → league_id=0` sentinel; all others → `league_id=1`), adds NOT NULL, drops/recreates constraint

### 2. DB Functions (`src/db/dbNotificationFunctions.ts`)
- `hasNotificationBeenSent(userId, leagueId, ...)` — `leagueId` added to WHERE clause
- `addNotificationLog(userId, leagueId, ...)` — `leagueId` added to INSERT
- `returnSentNotificationUserIds(leagueId, ...)` — `leagueId` added to WHERE clause
- `returnEmailOptedInUsers(notificationType, leagueId)` — when `leagueId > 0`, INNER JOINs `league_members` to scope results; sentinel `leagueId = 0` returns all users (used by admin broadcast)
- `getActiveLeaguesForWeek(year, weekNumber)` — NEW; `selectDistinct` over `league_games` → `admin.games` → `leagues` for the given week; used by cron loop

### 3. DB Functions (`src/db/dbLeagueFunctions.ts`)
- `getLeaguesForGame(gameId)` — NEW; returns all `leagueId`s containing a game; used by `admin.ts` score correction to dispatch per league

### 4. Dispatcher (`src/notifications/dispatcher.ts`)
- `dispatchNotification(params)` — accepts `leagueId` + `leagueName`; passes `leagueId` through to all DB calls; uses `SITE_WIDE_LEAGUE_ID = 0` sentinel for admin broadcast
- `dispatchGameComplete(leagueId, year, weekNumber)` — NEW convenience wrapper; looks up league name via `getLeagueById`, then calls `dispatchNotification`
- `dispatchAdminBroadcast` — unchanged; uses `SITE_WIDE_LEAGUE_ID = 0`

### 5. Email Templates (`src/notifications/templates.ts`)
- `picksReminderTemplate` — subject: `[LeagueName] Picks reminder — Week N locks in 1 hour`; body includes league name
- `picksReminder24hTemplate` — subject: `[LeagueName] Picks reminder — Week N locks in 24 hours`; body includes league name
- `rankingsUpdatedTemplate` — subject: `[LeagueName] Week N results are in`; body includes league name

### 6. Cron (`src/cron/cronTick.ts`)
- `getActiveLeaguesForWeek` called each tick to get leagues with games for the current week
- Per-league loop: `getGamesForLeagueWeek` → completion check → reminder checks
- In-memory Sets: `scoresCompletedForLeague` (`"leagueId-year-weekNumber"`) guards against double-dispatch of `rankings_updated`; `reminder24hSentForLeague` guards the 24h reminder
- 1h reminder (`picks_reminder_1h`) relies on DB-level dedup in the dispatcher (consistent with pre-Phase-6 behavior)
- Both Sets reset when `weekKey` changes

### 7. Routes
- `adminLeagues.ts`: `POST /:leagueId/games/complete` and `PATCH /:leagueId/games/:gameId/score` both call `dispatchGameComplete(leagueId, ...)`
- `admin.ts`: Global `PATCH /games/:gameId/score` now calls `getLeaguesForGame(gameId)` and dispatches per affected league

### 8. Frontend
- `adminRequests.ts`: `correctLeagueGameScore` now accepts and passes `year`/`weekNumber` query params (required by the score correction endpoint validator)
- `LeagueAdminSection.tsx`: Passes `weekHook.selectedYear` and `weekHook.selectedWeek` to `correctLeagueGameScore`

### 9. Tests (`packages/backend/tests/`)
- `setup.ts`: `notification_log` table schema includes `league_id`; unique constraint updated
- `db-utils.ts`: `createTestNotificationLog(userId, leagueId, ...)` helper updated; `createTestGame` signature updated (positional args)
- `notificationFunctions.test.ts`: Tests for `leagueId` dedup, `returnEmailOptedInUsers` league scoping, `getActiveLeaguesForWeek`
- `cronTick.test.ts`: Tests for per-league dispatch, `reminder24hSentForLeague` dedup, week-change resets, multi-league 1h dispatch
- `adminNotificationLogs.test.ts` / `adminScoreCorrection.test.ts`: Updated to pass `leagueId` to log helpers and mock `dispatchGameComplete`

---

## Remaining Steps

### Step 1 — Run migrations against test DB
```bash
cd packages/backend && NODE_ENV=test pnpm migrate
```

### Step 2 — Run full test suite
```bash
pnpm test
```
Expected: all existing tests pass; new tests for league-scoped notifications pass.

### Step 3 — Run build
```bash
pnpm build
```
Fix any TypeScript errors before committing.

---

## Verification Checklist (Acceptance Criteria)

- [ ] Marking games complete for League A only notifies League A members
- [ ] Marking games complete for League B in the same week only notifies League B members — League A not double-notified
- [ ] A user in both leagues receives two separate notifications (dedup does not suppress second one)
- [ ] Picks-reminder cron fires per-league: leagues with games for the week each get their own reminder
- [ ] League name appears in email subject (`[LeagueName] ...`) and body
- [ ] `notification_log` rows include `league_id`
- [ ] Admin broadcast is unaffected (site-wide, `league_id = 0` sentinel)
- [ ] `pnpm build` passes with no TypeScript errors
- [ ] All tests pass
