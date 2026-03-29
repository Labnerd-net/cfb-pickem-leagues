import { returnCurrentWeek } from '../db/dbAdminFunctions.js';
import { returnPickedGames, upsertGameForWeek } from '../db/dbAdminFunctions.js';
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
//   - Re-evaluation of notification windows (hardCapStart, reminder24hSentForWeek reset)
//
// User-facing safety net: dispatcher.ts calls hasNotificationBeenSent() before every send,
// which checks the DB, so notifications are never double-sent regardless of in-memory state.
// Persisting this state to a DB table is not necessary at current scale.
let lastRefreshAt: Date | null = null;
let hardCapStart: Date | null = null;
let scoresCompletedForWeek: string | null = null; // key: "year-week"
let lastWeekKey: string | null = null;
let reminder24hSentForWeek: string | null = null; // key: "year-week"

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
    reminder24hSentForWeek = null;
    lastWeekKey = weekKey;
    logger.info({ weekKey }, 'Week changed, resetting cron state');
  }

  // 2. Get picked games for the current week
  const games = await returnPickedGames(identifier);
  if (games.length === 0) return;

  // 3. Picks reminders
  const firstKickoff = getFirstKickoff(games);
  if (shouldSend24hrReminder({ now, firstKickoff }) && reminder24hSentForWeek !== weekKey) {
    reminder24hSentForWeek = weekKey;
    dispatchNotification({
      notificationType: 'picks_reminder_24h',
      year: week.year,
      weekNumber: week.weekNumber,
      firstKickoffTime: firstKickoff ?? undefined,
    }).catch(err => logger.error({ err }, 'picks_reminder_24h dispatch failed'));
  }
  if (shouldSendPicksReminder({ now, firstKickoff })) {
    dispatchNotification({
      notificationType: 'picks_reminder_1h',
      year: week.year,
      weekNumber: week.weekNumber,
      firstKickoffTime: firstKickoff ?? undefined,
    }).catch(err => logger.error({ err }, 'picks_reminder_1h dispatch failed'));
  }

  // 4. Score refresh
  const lastKickoff = getLastKickoff(games);

  // Start hard cap timer the first time we detect last kickoff is in the past
  if (lastKickoff && now >= lastKickoff && !hardCapStart) {
    hardCapStart = now;
    logger.info({ weekKey, lastKickoff }, 'hardCapStart set');
  }

  if (shouldRefreshScores({ now, lastKickoff, lastRefreshAt, hardCapStart })) {
    logger.info({ weekKey }, 'Refreshing scores');
    try {
      const gameData = await getGameData({ year: week.year, week: week.weekNumber, seasonType: week.seasonType });
      if (gameData?.length) {
        await Promise.all(gameData.map(g => upsertGameForWeek(g)));
      }
      lastRefreshAt = getNow();

      // Re-fetch to check completion
      const updatedGames = await returnPickedGames(identifier);
      if (isWeekComplete(updatedGames) && scoresCompletedForWeek !== weekKey) {
        scoresCompletedForWeek = weekKey;
        dispatchNotification({
          notificationType: 'rankings_updated',
          year: week.year,
          weekNumber: week.weekNumber,
        }).catch(err => logger.error({ err }, 'rankings_updated dispatch failed'));
      }
    } catch (e) {
      logger.error({ err: e, weekKey }, 'Score refresh failed');
    }
  }
}
