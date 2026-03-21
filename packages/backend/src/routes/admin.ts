import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as dbAdminFunctions from '../db/dbAdminFunctions.js';
import { returnUsers, updateUserRoles } from '../db/dbUserFunctions.js';
import { returnNotificationLogs } from '../db/dbNotificationFunctions.js';
import { getGameData, getWeekData } from '../api/index.js';
import type { JwtData } from '@shared/types/cfb-pickem-api.js';
import { authMiddleware, requireRole } from '../utils/middleware.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import { weekIdentifierValidator, pickedGameRequestValidator, updateUserRolesValidator, markGameCompleteValidator, yearQueryValidator, weekIdentifierQueryValidator } from '../utils/zValidate.js';
import { dispatchNotification } from '../notifications/dispatcher.js';
import { sendNtfyNotification } from '../notifications/ntfySender.js';
import { sendTelegramNotification } from '../notifications/telegramSender.js';
import { sendDiscordNotification } from '../notifications/discordSender.js';
import { ntfyEnabled, telegramEnabled, discordEnabled } from '../utils/envVars.js';
import logger from '../utils/logger.js';

type Variables = {
  jwtPayload: JwtData;
};

const admin = new Hono<{ Variables: Variables }>()
  // Return all users' details
  .get('/users', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const allUserProfiles = await returnUsers();
    return c.json({ allUserProfiles });
  })
  // Update a user's roles
  .patch(
    '/users/:id/roles',
    apiRateLimit,
    authMiddleware,
    requireRole('admin'),
    updateUserRolesValidator,
    async c => {
      const targetId = Number(c.req.param('id'));
      if (isNaN(targetId) || targetId < 1)
        throw new HTTPException(400, { message: 'id must be a positive integer' });
      const jwtPayload = c.get('jwtPayload');
      if (jwtPayload.sub === targetId)
        throw new HTTPException(403, { message: 'Cannot modify your own roles' });
      const { roles } = c.req.valid('json');
      const updated = await updateUserRoles(targetId, roles);
      if (updated.length === 0) throw new HTTPException(404, { message: 'User not found' });
      return c.json({ user: updated[0] });
    }
  )
  // Add Weeks to Year
  .post('/year/:year', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const yearNumber = Number(c.req.param('year'));
    if (isNaN(yearNumber) || yearNumber < 1900 || yearNumber > 2100)
      throw new HTTPException(400, { message: 'year must be between 1900 and 2100' });
    let weekData;
    try {
      weekData = await getWeekData(yearNumber);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new HTTPException(502, { message: `External API error: ${msg}` });
    }
    if (weekData?.length) {
      await Promise.all(weekData.map(week => dbAdminFunctions.addWeek(week)));
    }
    return c.json({ status: 'added all weeks' });
  })
  // Get Weeks for Year
  .get('/weeks', apiRateLimit, authMiddleware, requireRole('admin'), yearQueryValidator, async c => {
    const { year } = c.req.valid('query');
    const weeks = await dbAdminFunctions.returnWeeksByYear(year);
    return c.json({ weeks });
  })
  // Add Games to Week
  .post(
    '/week',
    apiRateLimit,
    authMiddleware,
    requireRole('admin'),
    weekIdentifierValidator,
    async c => {
      const weekIdentifier = c.req.valid('json');
      const weekQuery = await dbAdminFunctions.enrichWeekIdentifier(weekIdentifier);
      let gameData;
      try {
        gameData = await getGameData(weekQuery);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new HTTPException(502, { message: `External API error: ${msg}` });
      }
      if (!gameData?.length) {
        throw new HTTPException(422, {
          message: 'No games returned from external API for this week',
        });
      }
      await Promise.all(gameData.map(game => dbAdminFunctions.upsertGameForWeek(game)));
      dispatchNotification({
        notificationType: 'games_ready',
        year: weekIdentifier.year,
        weekNumber: weekIdentifier.week,
      }).catch(err => logger.error({ err }, 'games_ready dispatch failed'));
      return c.json({ status: `imported ${gameData.length} games` });
    }
  )
  // Get Games for Week
  .get('/games', apiRateLimit, authMiddleware, requireRole('admin'), weekIdentifierQueryValidator, async c => {
    const { year, weekNumber } = c.req.valid('query');
    const weekGames = await dbAdminFunctions.returnGamesForWeek({ year, week: weekNumber });
    return c.json({ weekGames });
  })
  // Set picked games
  .post(
    '/picks',
    apiRateLimit,
    authMiddleware,
    requireRole('admin'),
    pickedGameRequestValidator,
    async c => {
      const pickedData = c.req.valid('json');
      if (pickedData.games.length === 0)
        throw new HTTPException(422, { message: 'games array must not be empty' });
      await dbAdminFunctions.setPickedGames(pickedData);
      return c.json({ status: 'updated picked games' });
    }
  )
  // Mark a game complete with final scores (dev/test only — blocked in production)
  .post(
    '/games/complete',
    apiRateLimit,
    authMiddleware,
    requireRole('admin'),
    markGameCompleteValidator,
    async c => {
      if (process.env.NODE_ENV === 'production') {
        throw new HTTPException(403, { message: 'Not available in production' });
      }
      const { gameId, homePoints, awayPoints } = c.req.valid('json');
      const gameRows = await dbAdminFunctions.returnGame(gameId);
      if (!gameRows || gameRows.length === 0)
        throw new HTTPException(404, { message: 'Game not found' });
      const game = gameRows[0];
      const updated = await dbAdminFunctions.markGameComplete(gameId, homePoints, awayPoints);
      if (!updated) throw new HTTPException(404, { message: 'Game not found' });

      // Dispatch rankings_updated if all picked games for the week are now complete
      const weekGames = await dbAdminFunctions.returnPickedGames({
        year: game.year,
        week: game.weekNumber,
      });
      if (weekGames.length > 0 && weekGames.every(g => g.completed)) {
        dispatchNotification({
          notificationType: 'rankings_updated',
          year: game.year,
          weekNumber: game.weekNumber,
        }).catch(err => logger.error({ err }, 'rankings_updated dispatch failed'));
      }

      return c.json({ game: updated });
    }
  )
  // Return notification log entries (most recent 500)
  .get('/notification-logs', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const { entries, total } = await returnNotificationLogs(500);
    return c.json({ entries, total });
  })
  // Test broadcast notifications (admin only — does not log to notification_log)
  .post('/notifications/test', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const title = "CFB Pick'em test notification";
    const message = 'This is a test broadcast from your CFB Pick\'em admin panel.';
    const results: Record<string, boolean> = {};

    if (ntfyEnabled) {
      results.ntfy = await sendNtfyNotification({ title, message });
    }
    if (telegramEnabled) {
      results.telegram = await sendTelegramNotification({ title, message });
    }
    if (discordEnabled) {
      results.discord = await sendDiscordNotification({ title, message });
    }

    return c.json({ results });
  });

export default admin;
