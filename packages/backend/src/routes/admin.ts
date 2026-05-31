import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { hashPassword } from '../utils/password.js';
import { validatePassword } from '../utils/passwordValidation.js';
import * as dbAdminFunctions from '../db/dbAdminFunctions.js';
import { returnUsers, updateUserRoles, updateUserPassword, returnUserPickTotals } from '../db/dbUserFunctions.js';
import { returnNotificationLogs } from '../db/dbNotificationFunctions.js';
import { getLeaguesForGame } from '../db/dbLeagueFunctions.js';
import { getGamesForLeagueWeek } from '../db/dbAdminFunctions.js';
import { isWeekComplete } from '../cron/cronLogic.js';
import { getGameData, getWeekData } from '../api/index.js';
import type { JwtData, Team } from '@shared/types/cfb-pickem-api.js';
import { authMiddleware, requireRole } from '../utils/middleware.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { updateUserRolesValidator, weekIdentifierValidator, markGameCompleteValidator, yearQueryValidator, weekIdentifierQueryValidator, correctGameScoreParamValidator, correctGameScoreBodyValidator, adminBroadcastBodyValidator, resetPasswordParamValidator, resetPasswordBodyValidator } from '../utils/zValidate.js';
import { dispatchAdminBroadcast, dispatchGameComplete } from '../notifications/dispatcher.js';
import { getNow } from '../utils/clock.js';
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
  // Reset a user's password (admin only)
  .patch(
    '/users/:id/password',
    apiRateLimit,
    authMiddleware,
    requireRole('admin'),
    resetPasswordParamValidator,
    resetPasswordBodyValidator,
    async c => {
      const { id: targetId } = c.req.valid('param');
      const jwtPayload = c.get('jwtPayload');
      if (jwtPayload.sub === targetId)
        throw new HTTPException(403, { message: 'Cannot reset your own password' });
      const { password } = c.req.valid('json');
      const validation = validatePassword(password);
      if (!validation.valid)
        throw new HTTPException(400, { message: validation.error! });
      const passwordHash = await hashPassword(password);
      const found = await updateUserPassword(targetId, passwordHash);
      if (!found) throw new HTTPException(404, { message: 'User not found' });
      return c.json({ status: 'password updated' });
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
  // Delete all weeks and games for a year
  .delete('/year/:year', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const yearNumber = Number(c.req.param('year'));
    if (isNaN(yearNumber) || yearNumber < 1900 || yearNumber > 2100)
      throw new HTTPException(400, { message: 'year must be between 1900 and 2100' });
    const haspicks = await dbAdminFunctions.hasPicksForYear(yearNumber);
    if (haspicks)
      throw new HTTPException(409, { message: 'Cannot delete year: user picks exist for this season' });
    await dbAdminFunctions.deleteGamesForYear(yearNumber);
    await dbAdminFunctions.deleteWeeksForYear(yearNumber);
    return c.json({ status: 'deleted' });
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

      // Postseason weeks are stored offset by the regular season count.
      // Compute the original CFBD week number for the API call.
      let cfbdWeek: number | undefined;
      if (weekQuery.seasonType === 'postseason') {
        const regularCount = await dbAdminFunctions.getMaxRegularWeek(weekQuery.year);
        cfbdWeek = weekQuery.week - regularCount;
      }

      let gameData;
      try {
        gameData = await getGameData(weekQuery, undefined, cfbdWeek);
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
      return c.json({ status: `imported ${gameData.length} games` });
    }
  )
  // Get Games for Week
  .get('/games', apiRateLimit, authMiddleware, requireRole('admin'), weekIdentifierQueryValidator, async c => {
    const { year, weekNumber } = c.req.valid('query');
    const weekGames = await dbAdminFunctions.returnGamesForWeek({ year, week: weekNumber });
    return c.json({ weekGames });
  })
  // Mark a game complete with final scores
  .post(
    '/games/complete',
    apiRateLimit,
    authMiddleware,
    requireRole('admin'),
    markGameCompleteValidator,
    async c => {
      const { gameId, homePoints, awayPoints } = c.req.valid('json');
      const gameRows = await dbAdminFunctions.returnGame(gameId);
      if (!gameRows || gameRows.length === 0)
        throw new HTTPException(404, { message: 'Game not found' });
      const updated = await dbAdminFunctions.markGameComplete(gameId, homePoints, awayPoints);
      if (!updated) throw new HTTPException(404, { message: 'Game not found' });

      // Note: rankings_updated notification is per-league and will be dispatched in Phase 6

      return c.json({ game: updated });
    }
  )
  // Correct a game's final score (production-safe; writes audit row)
  .patch(
    '/games/:gameId/score',
    apiRateLimit,
    authMiddleware,
    requireRole('admin'),
    correctGameScoreParamValidator,
    correctGameScoreBodyValidator,
    async c => {
      const { gameId } = c.req.valid('param');
      const { homePoints, awayPoints } = c.req.valid('json');
      const correctedBy = c.get('jwtPayload').sub;

      const current = await dbAdminFunctions.getGameById(gameId);
      if (!current) throw new HTTPException(404, { message: 'Game not found' });

      let winningTeam: Team = 'pending';
      if (homePoints > awayPoints) winningTeam = 'home_team';
      else if (awayPoints > homePoints) winningTeam = 'away_team';

      const updated = await dbAdminFunctions.correctGameScore(
        gameId, homePoints, awayPoints, winningTeam,
        current.homePoints, current.awayPoints, correctedBy
      );
      if (!updated) throw new HTTPException(404, { message: 'Game not found' });

      const affectedLeagues = await getLeaguesForGame(gameId);
      for (const { leagueId } of affectedLeagues) {
        const leagueGames = await getGamesForLeagueWeek(leagueId, updated.year, updated.weekNumber);
        if (isWeekComplete(leagueGames)) {
          dispatchGameComplete(leagueId, updated.year, updated.weekNumber)
            .catch(err => logger.error({ err, leagueId }, 'rankings_updated dispatch failed after score correction'));
        }
      }

      return c.json({ game: updated });
    }
  )
  // Return notification log entries with pagination.
  // Hard cap: 500 rows max per page. Sufficient for ~1–2 seasons at this scale.
  .get(
    '/notification-logs',
    apiRateLimit,
    authMiddleware,
    requireRole('admin'),
    zValidator(
      'query',
      z.object({
        limit: z.coerce.number().min(1).max(500).default(50),
        offset: z.coerce.number().min(0).default(0),
        channel: z.enum(['email', 'ntfy', 'telegram', 'discord']).optional(),
        notificationType: z.enum(['games_ready', 'picks_reminder_1h', 'picks_reminder_24h', 'rankings_updated', 'admin_broadcast']).optional(),
      })
    ),
    async c => {
      const { limit, offset, channel, notificationType } = c.req.valid('query');
      const { entries, total } = await returnNotificationLogs(limit, offset, channel, notificationType);
      return c.json({ entries, total });
    }
  )
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
  })
  // Export user list with all-time pick totals
  .get('/users/export', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const [allUsers, pickTotals] = await Promise.all([returnUsers(), returnUserPickTotals()]);
    const totalsById = new Map(pickTotals.map(t => [t.userId, t]));
    const users = allUsers.map(u => {
      const totals = totalsById.get(u.userId) ?? { total: 0, correct: 0 };
      const accuracy = totals.total === 0 ? 0 : totals.correct / totals.total;
      return {
        userId: u.userId,
        displayName: u.displayName,
        email: u.email,
        roles: u.roles,
        total: totals.total,
        correct: totals.correct,
        accuracy,
      };
    });
    return c.json({ users });
  })
  // Send a free-form admin broadcast notification to all users
  .post(
    '/notifications/broadcast',
    apiRateLimit,
    authMiddleware,
    requireRole('admin'),
    adminBroadcastBodyValidator,
    async c => {
      const { subject, message, overrideEmailPreferences } = c.req.valid('json');
      const { year, weekNumber } = await dbAdminFunctions.resolveWeekContext(getNow());
      await dispatchAdminBroadcast(subject, message, overrideEmailPreferences, year, weekNumber);
      return c.json({ success: true });
    }
  );

export default admin;
