import { returnCurrentWeek, returnGamesForWeek, upsertGameForWeek } from '../db/dbAdminFunctions.js';
import { getActiveLeaguesForWeek } from '../db/dbNotificationFunctions.js';
import { getGamesForLeagueWeek } from '../db/dbAdminFunctions.js';
import { dispatchNotification } from '../notifications/dispatcher.js';
import { getGameData } from '../api/index.js';
import logger from '../utils/logger.js';
import { getNow } from '../utils/clock.js';
import {
  shouldSendPicksReminder,
  shouldSend24hrReminder,
  shouldRefreshScores,
  isWeekComplete,
  getFirstKickoff,
  getLastKickoff,
} from './cronLogic.js';

// Module-level cron state — resets on process restart (by design).
//
// On restart mid-week the only observable side effects are:
//   - An immediate CFBD API refresh (lastRefreshAt reset → shouldRefreshScores returns true)
//   - Re-evaluation of notification windows (hardCapStart, per-league reminder/completion Sets reset)
//
// User-facing safety net: dispatcher.ts calls hasNotificationBeenSent() before every send,
// which checks the DB, so notifications are never double-sent regardless of in-memory state.
// Persisting this state to a DB table is not necessary at current scale.
let lastRefreshAt: Date | null = null;
let hardCapStart: Date | null = null;
let lastWeekKey: string | null = null;
let scoresCompletedForLeague = new Set<string>(); // key: "leagueId-year-weekNumber"
let reminder24hSentForLeague = new Set<string>();  // key: "leagueId-year-weekNumber"
let reminder1hSentForLeague = new Set<string>();   // key: "leagueId-year-weekNumber"

export async function runCronTick(): Promise<void> {
  const now = getNow();
  logger.debug('runCronTick');

  // 1. Find the current week
  const week = await returnCurrentWeek(now);
  if (!week) {
    logger.debug('No current week found, skipping cron tick');
    return;
  }

  const weekKey = `${week.year}-${week.weekNumber}`;
  const identifier = { year: week.year, week: week.weekNumber };

  // Reset per-week state when the active week changes
  if (weekKey !== lastWeekKey) {
    hardCapStart = null;
    lastRefreshAt = null;
    scoresCompletedForLeague = new Set();
    reminder24hSentForLeague = new Set();
    reminder1hSentForLeague = new Set();
    lastWeekKey = weekKey;
    logger.info({ weekKey }, 'Week changed, resetting cron state');
  }

  // 2. Get active leagues for this week
  const activeLeagues = await getActiveLeaguesForWeek(week.year, week.weekNumber);
  if (activeLeagues.length === 0) return;

  // 3. Get global games for hard cap / last-kickoff tracking
  const globalGames = await returnGamesForWeek(identifier);
  if (globalGames.length === 0) return;

  // 4. Score refresh
  const lastKickoff = getLastKickoff(globalGames);

  if (lastKickoff && now >= lastKickoff && !hardCapStart) {
    hardCapStart = now;
    logger.info({ weekKey, lastKickoff }, 'hardCapStart set');
  }

  let didRefresh = false;
  if (shouldRefreshScores({ now, lastKickoff, lastRefreshAt, hardCapStart })) {
    logger.info({ weekKey }, 'Refreshing scores');
    try {
      const gameData = await getGameData({ year: week.year, week: week.weekNumber, seasonType: week.seasonType });
      if (gameData?.length) {
        await Promise.all(gameData.map(g => upsertGameForWeek(g)));
      }
      lastRefreshAt = getNow();
      didRefresh = true;
    } catch (e) {
      logger.error({ err: e, weekKey }, 'Score refresh failed');
    }
  }

  // 5. Per-league loop — completion check and reminder checks
  for (const league of activeLeagues) {
    const leagueWeekKey = `${league.leagueId}-${week.year}-${week.weekNumber}`;

    let leagueGames;
    try {
      leagueGames = await getGamesForLeagueWeek(league.leagueId, week.year, week.weekNumber);
    } catch (e) {
      logger.error({ err: e, leagueId: league.leagueId, weekKey }, 'Failed to fetch league games');
      continue;
    }

    if (leagueGames.length === 0) continue;

    // Completion check — only after a fresh score refresh
    if (didRefresh && !scoresCompletedForLeague.has(leagueWeekKey) && isWeekComplete(leagueGames)) {
      scoresCompletedForLeague.add(leagueWeekKey);
      dispatchNotification({
        notificationType: 'rankings_updated',
        leagueId: league.leagueId,
        leagueName: league.name,
        year: week.year,
        weekNumber: week.weekNumber,
      }).catch(err => logger.error({ err, leagueId: league.leagueId }, 'rankings_updated dispatch failed'));
    }

    // Reminder checks
    const firstKickoff = getFirstKickoff(leagueGames);

    if (shouldSend24hrReminder({ now, firstKickoff }) && !reminder24hSentForLeague.has(leagueWeekKey)) {
      reminder24hSentForLeague.add(leagueWeekKey);
      dispatchNotification({
        notificationType: 'picks_reminder_24h',
        leagueId: league.leagueId,
        leagueName: league.name,
        year: week.year,
        weekNumber: week.weekNumber,
        firstKickoffTime: firstKickoff ?? undefined,
      }).catch(err => logger.error({ err, leagueId: league.leagueId }, 'picks_reminder_24h dispatch failed'));
    }

    if (shouldSendPicksReminder({ now, firstKickoff }) && !reminder1hSentForLeague.has(leagueWeekKey)) {
      reminder1hSentForLeague.add(leagueWeekKey);
      dispatchNotification({
        notificationType: 'picks_reminder_1h',
        leagueId: league.leagueId,
        leagueName: league.name,
        year: week.year,
        weekNumber: week.weekNumber,
        firstKickoffTime: firstKickoff ?? undefined,
      }).catch(err => logger.error({ err, leagueId: league.leagueId }, 'picks_reminder_1h dispatch failed'));
    }
  }
}
