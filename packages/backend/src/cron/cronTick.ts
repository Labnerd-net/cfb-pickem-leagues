import {
  returnActiveWeek,
  returnNextKickoffAfter,
  returnGamesForWeek,
  upsertGamesForWeek,
} from '../db/dbAdminFunctions.js';
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

// KV cache key/bounds for the "nothing to check yet" short-circuit below. Rather than a
// flat TTL, we cache the timestamp of the next moment worth checking (25h before the next
// known kickoff), so we resume exactly when a real window opens instead of on a blind timer
// that can straddle it. Still clamped to an hour max so off-season DB-wake protection
// (see context/current-feature.md history) is no worse than before.
const NEXT_CHECK_CACHE_KEY = 'cron:next-check-at';
const NEXT_CHECK_MIN_TTL_SECONDS = 60; // KV's expirationTtl minimum
const NEXT_CHECK_MAX_TTL_SECONDS = 60 * 60;

export async function runCronTick(cronCacheKv?: KVNamespace): Promise<void> {
  const now = getNow();
  logger.debug('runCronTick');

  if (cronCacheKv) {
    const cached = await cronCacheKv.get(NEXT_CHECK_CACHE_KEY);
    if (cached && now.getTime() < Number(cached)) {
      logger.debug('No active/upcoming week window yet (cached), skipping cron tick');
      return;
    }
  }

  // 1. Find the week whose games are actively in-window right now
  const week = await returnActiveWeek(now);
  if (!week) {
    if (cronCacheKv) {
      const nextKickoff = await returnNextKickoffAfter(now);
      const nextCheckAt = nextKickoff
        ? nextKickoff.getTime() - 25 * 60 * 60 * 1000
        : now.getTime() + NEXT_CHECK_MAX_TTL_SECONDS * 1000;
      const ttlSeconds = Math.min(
        NEXT_CHECK_MAX_TTL_SECONDS,
        Math.max(NEXT_CHECK_MIN_TTL_SECONDS, Math.ceil((nextCheckAt - now.getTime()) / 1000))
      );
      await cronCacheKv.put(NEXT_CHECK_CACHE_KEY, String(now.getTime() + ttlSeconds * 1000), {
        expirationTtl: ttlSeconds,
      });
    }
    logger.debug('No active week found, skipping cron tick');
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
        await upsertGamesForWeek(gameData);
      }
      lastRefreshAt = getNow();
      didRefresh = true;
    } catch (e) {
      logger.error({ err: e, weekKey }, 'Score refresh failed');
    }
  }

  // 5. Per-league loop — completion check and reminder checks
  const leagueGameResults = await Promise.allSettled(
    activeLeagues.map(league => getGamesForLeagueWeek(league.leagueId, week.year, week.weekNumber))
  );

  for (let i = 0; i < activeLeagues.length; i++) {
    const league = activeLeagues[i];
    const leagueWeekKey = `${league.leagueId}-${week.year}-${week.weekNumber}`;
    const gameResult = leagueGameResults[i];

    if (gameResult.status === 'rejected') {
      logger.error({ err: gameResult.reason, leagueId: league.leagueId, weekKey }, 'Failed to fetch league games');
      continue;
    }

    const leagueGames = gameResult.value;
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
