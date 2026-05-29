# Spec: Multi-League — Phase 6: League-Scoped Notifications

## Goal

Scope all game-complete and picks-reminder notifications to the relevant league. A notification triggered by a league admin marking games complete goes only to that league's members, not all site users. After this phase the notification system is fully multi-league aware.

Depends on: Phase 3 (league-scoped mark-complete endpoint), Phase 5 (UI triggers mark-complete per league).

---

## Current Behavior

The existing notification dispatcher (`src/notifications/dispatcher.ts`) operates globally:
- Fetches all users from the DB
- Checks each user's notification preferences
- Sends game-complete emails to all opted-in users across the entire site

This must change: notifications should target only members of the league that triggered the event.

---

## Schema Change

### `notification_log` — add `league_id`

The deduplication log currently has unique key:
```
(user_id, year, week_number, notification_type, channel)
```

Add `league_id` to the unique key so the same user can receive a game-complete notification for League A and League B in the same week without either being suppressed:
```
(user_id, league_id, year, week_number, notification_type, channel)
```

Migration: add nullable `league_id` column, backfill existing rows with the default league id, add NOT NULL constraint, drop old unique constraint, add new unique constraint.

---

## Dispatcher Changes (`src/notifications/dispatcher.ts`)

### `dispatchGameComplete(leagueId, year, weekNumber)`

Replace the current global user fetch with a league-scoped member fetch:
1. Fetch all members of the given league from `league_members`
2. For each member, check notification preferences and deduplication log (now keyed by `leagueId`)
3. Send notifications only to those members

The `leagueId` must be passed all the way from the mark-complete route handler through the dispatcher.

### `dispatchPicksReminder(leagueId, year, weekNumber)` (picks-reminder-1h, picks-reminder-24h)

Same change: scope to league members. The cron job fires globally, but for each league it must:
- Know which leagues are active for the current week (leagues that have at least one game in `league_games` for that week)
- Fire the reminder scoped to each such league independently

### `dispatchAdminBroadcast`

Admin broadcast is a site-level action (not league-scoped). No change needed.

---

## Cron Job Changes (`src/notifications/cronTick.ts`, `cronLogic.ts`)

Currently the cron job has one stateful context (one week, one set of sent-flags). With multiple leagues, each league can have its own game pool for the week, so:

- `shouldSend1hrReminder(leagueId, ...)` — checks whether the first game in the league's pool is within the 1-hour window
- `shouldSend24hrReminder(leagueId, ...)` — same for 24h window
- Cron state tracks sent-flags per league: `reminder1hSentForLeague: Set<number>`, `reminder24hSentForLeague: Set<number>`
- On each cron tick, iterate over all leagues that have games for the current week and evaluate reminders independently

The existing "week changed → reset flags" logic must reset per-league flags when a league's active week changes (or when the global week rolls over).

---

## DB Function Changes

### `dbNotificationFunctions.ts`
- `hasNotificationBeenSent(userId, leagueId, year, weekNumber, notificationType, channel)` — add `leagueId` param
- `markNotificationSent(userId, leagueId, year, weekNumber, notificationType, channel)` — add `leagueId` param
- `returnSentNotificationUserIds(leagueId, year, weekNumber, notificationType, channel)` — add `leagueId` param
- New: `getActiveLeaguesForWeek(year, weekNumber)` — returns league ids that have at least one game in `league_games` for that week (used by cron)

---

## Email Template Changes (`src/notifications/templates.ts`)

- Add league name to game-complete and picks-reminder email subjects/bodies so recipients know which league the notification is for
  - e.g., subject: `"[Rivalry League] Picks reminder — Week 3 locks in 1 hour"`
  - body: include league name in greeting or header
- Templates receive a `leagueName: string` parameter

---

## Acceptance Criteria

- [ ] Marking games complete for League A sends notifications only to League A members
- [ ] Marking games complete for League B in the same week sends notifications only to League B members — League A members are not double-notified
- [ ] A user in both leagues receives two separate notifications (one per league) — deduplication does not suppress the second one
- [ ] Picks-reminder cron fires per-league: leagues with games in that week get their own reminder
- [ ] League name appears in email subject and body
- [ ] `notification_log` rows include `league_id`
- [ ] Admin broadcast is unaffected (still site-wide)
- [ ] `pnpm build` passes

---

## Out of Scope for This Phase

- Per-user notification opt-in per league (global opt-in still applies)
- In-app notification UI
- Push notifications beyond existing ntfy/Telegram/Discord channels
