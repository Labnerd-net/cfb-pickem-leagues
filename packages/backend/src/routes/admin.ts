import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as dbAdminFunctions from '../db/dbAdminFunctions.js';
import { returnUsers } from '../db/dbUserFunctions.js';
import { getGameData, getWeekData } from '../api/index.js';
import type { JwtData, ProfileData, WeekIdentifier } from '@shared/types/cfb-pickem-api.js';
import { authMiddleware, requireRole } from '../utils/middleware.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import { weekIdentifierValidator, pickedGameRequestValidator } from '../utils/zValidate.js';

type Variables = {
  jwtPayload: JwtData;
};

const admin = new Hono<{ Variables: Variables }>()
  // Return all users' details
  .get('/users', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const allUsers = await returnUsers();
    const allUserProfiles: ProfileData[] = allUsers;
    return c.json({ allUserProfiles });
  })
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
  .get('/weeks', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const yearNumber = Number(c.req.query('year'));
    if (isNaN(yearNumber) || yearNumber < 1900 || yearNumber > 2100)
      throw new HTTPException(400, { message: 'year must be between 1900 and 2100' });
    const weeks = await dbAdminFunctions.returnWeeksByYear(yearNumber);
    return c.json({ weeks });
  })
  // Add Games to Week
  .post(
    '/week',
    apiRateLimit,
    weekIdentifierValidator,
    authMiddleware,
    requireRole('admin'),
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
      return c.json({ status: `imported ${gameData.length} games` });
    }
  )
  // Get Games for Week
  .get('/games', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const weekIdentifier: WeekIdentifier = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
    };
    if (isNaN(weekIdentifier.year) || weekIdentifier.year < 1900 || weekIdentifier.year > 2100)
      throw new HTTPException(400, { message: 'year must be between 1900 and 2100' });
    if (isNaN(weekIdentifier.week) || weekIdentifier.week < 1 || weekIdentifier.week > 52)
      throw new HTTPException(400, { message: 'week must be between 1 and 52' });
    const weekGames = await dbAdminFunctions.returnGamesForWeek(weekIdentifier);
    return c.json({ weekGames });
  })
  // Set picked games
  .post(
    '/picks',
    apiRateLimit,
    pickedGameRequestValidator,
    authMiddleware,
    requireRole('admin'),
    async c => {
      const pickedData = c.req.valid('json');
      if (pickedData.games.length === 0)
        throw new HTTPException(422, { message: 'games array must not be empty' });
      await dbAdminFunctions.setPickedGames(pickedData);
      return c.json({ status: 'updated picked games' });
    }
  );

export default admin;
