import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { setCookie } from 'hono/cookie';
import { hashPassword, verifyPassword } from '../utils/password.js';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import {
  returnWeeksByYear,
  returnWeekByQuery,
  returnGamesBulk,
  getGamesForLeagueWeek,
} from '../db/dbAdminFunctions.js';
import { getLeagueMembership, getLeagueChannels } from '../db/dbLeagueFunctions.js';
import {
  returnNotificationSettings,
  upsertNotificationPreference,
} from '../db/dbNotificationFunctions.js';
import type {
  AdminDbGameData,
  AdminWeekData,
  AllUserGamePicksRequest,
  JwtData,
  ProfileData,
  WeekIdentifier,
} from '@shared/types/cfb-pickem-api.js';
import { authMiddleware } from '../utils/middleware.js';
import {
  ignorePickDeadline,
  jwtAlgorithm,
  getJwtExpirationSeconds,
  jwtSecret,
  jwtExpirationDays,
  isProduction,
} from '../utils/envVars.js';
import { getNow } from '../utils/clock.js';
import { validatePassword } from '../utils/passwordValidation.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import {
  allUserPickedRequestValidator,
  notificationPreferenceValidator,
  yearQueryValidator,
  weekIdentifierQueryValidator,
  updateProfileValidator,
  leagueIdQueryValidator,
  optionalLeagueIdQueryValidator,
} from '../utils/zValidate.js';
import { requireLeagueMembership } from '../utils/middleware.js';

type Variables = {
  jwtPayload: JwtData;
  leagueMembership: { leagueId: number; userId: number; role: string; joinedAt: Date };
};

const user = new Hono<{ Variables: Variables }>()
  // Show user info
  .get('/profile', apiRateLimit, authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const userData = await dbUserFunctions.returnUserById(payload.sub);
    if (!userData || userData.length !== 1)
      throw new HTTPException(404, { message: 'User not found' });
    const profile: ProfileData = userData[0];
    return c.json(profile);
  })
  // Update user profile (display name and/or password)
  .patch('/profile', apiRateLimit, authMiddleware, updateProfileValidator, async c => {
    const payload = c.get('jwtPayload');
    const { displayName, currentPassword, newPassword } = c.req.valid('json');

    const updateFields: { displayName?: string; passwordHash?: string } = {};

    if (displayName !== undefined) {
      updateFields.displayName = displayName;
    }

    if (currentPassword !== undefined && newPassword !== undefined) {
      const user = await dbUserFunctions.returnUserById(payload.sub);
      if (!user || user.length === 0)
        throw new HTTPException(404, { message: 'User not found' });

      const isValid = await verifyPassword(currentPassword, user[0].passwordHash);
      if (!isValid)
        throw new HTTPException(401, { message: 'Current password is incorrect' });

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid)
        throw new HTTPException(400, { message: passwordValidation.error! });

      updateFields.passwordHash = await hashPassword(newPassword);
    }

    const updated = await dbUserFunctions.updateUserProfile(payload.sub, updateFields);
    if (!updated || updated.length === 0)
      throw new HTTPException(404, { message: 'User not found' });

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'Strict' as const,
      secure: isProduction,
      path: '/',
      maxAge: jwtExpirationDays * 24 * 60 * 60,
    };

    const newPayload = {
      sub: updated[0].userId,
      email: updated[0].email,
      displayName: updated[0].displayName,
      roles: updated[0].roles,
      emailVerified: updated[0].emailVerified ?? false,
      exp: getJwtExpirationSeconds(),
    };
    const token = await sign(newPayload, jwtSecret, jwtAlgorithm);
    setCookie(c, 'auth_token', token, cookieOptions);

    return c.json({ status: 'updated' });
  })
  // Get user game picks (league-scoped)
  .get('/picks', apiRateLimit, authMiddleware, weekIdentifierQueryValidator, leagueIdQueryValidator, requireLeagueMembership(), async c => {
    const payload = c.get('jwtPayload');
    const year = Number(c.req.query('year'));
    const weekNumber = Number(c.req.query('weekNumber'));
    const leagueId = Number(c.req.query('leagueId'));
    const picks = await dbUserFunctions.returnUserGames({ year, week: weekNumber }, payload.sub, leagueId);
    return c.json({ picks });
  })
  // Get per-week pick history for a year (league-scoped)
  .get('/history', apiRateLimit, authMiddleware, yearQueryValidator, leagueIdQueryValidator, requireLeagueMembership(), async c => {
    const payload = c.get('jwtPayload');
    const year = Number(c.req.query('year'));
    const leagueId = Number(c.req.query('leagueId'));
    const history = await dbUserFunctions.returnUserPickHistory(year, payload.sub, leagueId);
    return c.json({ history });
  })
  // List weeks in a year with picked games
  .get('/weeks', apiRateLimit, authMiddleware, yearQueryValidator, async c => {
    const { year } = c.req.valid('query');
    const weeks: AdminWeekData[] = await returnWeeksByYear(year);
    if (!weeks || weeks.length === 0)
      throw new HTTPException(404, { message: 'No weeks available for this year' });
    return c.json({ weeks });
  })
  // Get league's game pool for a week
  .get('/games', apiRateLimit, authMiddleware, weekIdentifierQueryValidator, leagueIdQueryValidator, requireLeagueMembership(), async c => {
    const year = Number(c.req.query('year'));
    const weekNumber = Number(c.req.query('weekNumber'));
    const leagueId = Number(c.req.query('leagueId'));
    const weekIdentifier: WeekIdentifier = { year, week: weekNumber };
    const week = await returnWeekByQuery(weekIdentifier);
    if (!week || week.length === 0) throw new HTTPException(404, { message: 'Week not found' });
    const pickedGames: AdminDbGameData[] = await getGamesForLeagueWeek(leagueId, year, weekNumber);
    return c.json({ pickedGames });
  })
  // Set user game picks (league-scoped)
  .post('/picks', apiRateLimit, authMiddleware, allUserPickedRequestValidator, async c => {
    const payload = c.get('jwtPayload');
    const userPicks: AllUserGamePicksRequest = c.req.valid('json');
    const { leagueId } = userPicks;

    // Verify league membership (leagueId is in body, not path param)
    const membership = await getLeagueMembership(leagueId, payload.sub);
    if (!membership) throw new HTTPException(403, { message: 'Forbidden' });

    const gameIds = userPicks.games.map(p => p.game);
    if (new Set(gameIds).size !== gameIds.length)
      throw new HTTPException(400, { message: 'Duplicate game IDs in picks request' });

    // Validate all games before writing anything — prevents partial commits
    const [fetchedGames, leagueGameList] = await Promise.all([
      returnGamesBulk(gameIds),
      getGamesForLeagueWeek(leagueId, userPicks.year, userPicks.week),
    ]);
    const gameMap = new Map(fetchedGames.map(g => [g.gameId, g]));
    const leagueGameIds = new Set(leagueGameList.map(g => g.gameId));

    for (const pick of userPicks.games) {
      const game = gameMap.get(pick.game);
      if (!game) {
        throw new HTTPException(404, { message: `Game ${pick.game} not found` });
      }

      if (game.year !== userPicks.year || game.weekNumber !== userPicks.week) {
        throw new HTTPException(422, {
          message: `Game ${pick.game} does not belong to week ${userPicks.week} of ${userPicks.year}.`,
        });
      }

      if (!leagueGameIds.has(pick.game)) {
        throw new HTTPException(422, {
          message: `Game ${pick.game} is not in this league's pool for this week.`,
        });
      }

      if (!ignorePickDeadline) {
        if (game.startTime === null) {
          throw new HTTPException(422, {
            message: `Game ${pick.game} has no start time set and cannot accept picks.`,
          });
        }
        if (getNow() >= game.startTime) {
          throw new HTTPException(422, {
            message: `Game ${pick.game} (${game.awayTeam} @ ${game.homeTeam}) is locked — kickoff has passed. Check your other picks too.`,
          });
        }
      }
    }

    await dbUserFunctions.addPickedGamesBatch(userPicks.games, payload.sub, leagueId);
    return c.json({ status: 'updated picked games' });
  })
  // Get notification settings
  .get('/notifications/preferences', apiRateLimit, authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const settings = await returnNotificationSettings(payload.sub);
    return c.json(settings);
  })
  // Update a notification preference
  .patch('/notifications/preferences', apiRateLimit, authMiddleware, notificationPreferenceValidator, async c => {
    const payload = c.get('jwtPayload');
    const { notificationType, channel, enabled } = c.req.valid('json');
    await upsertNotificationPreference(payload.sub, notificationType, channel, enabled);
    return c.json({ status: 'updated' });
  })
  // Return broadcast channels for a league (members only — no tokens/webhooks)
  .get('/notifications/channels', apiRateLimit, authMiddleware, optionalLeagueIdQueryValidator, async c => {
    const { leagueId } = c.req.valid('query');
    if (!leagueId) {
      return c.json({ ntfy: null, telegram: null, discord: null });
    }
    const payload = c.get('jwtPayload');
    const membership = await getLeagueMembership(leagueId, payload.sub);
    if (!membership) throw new HTTPException(403, { message: 'Forbidden' });
    const config = await getLeagueChannels(leagueId);
    return c.json({
      ntfy: config?.ntfyTopicUrl ? { topicUrl: config.ntfyTopicUrl } : null,
      telegram: config?.telegramInviteUrl ? { inviteUrl: config.telegramInviteUrl } : null,
      discord: config?.discordInviteUrl ? { inviteUrl: config.discordInviteUrl } : null,
    });
  });

export default user;
