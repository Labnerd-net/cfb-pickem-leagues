import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as dbAdminFunctions from '../db/dbAdminFunctions.js';
import { returnUsers } from '../db/dbUserFunctions.js';
import { getGameData, getWeekData } from '../api/index.js';
import type {
  JwtData,
  ProfileData,
  WeekIdentifier,
  PickedGamesRequest,
} from '@shared/types/cfb-pickem-api.js';
import { authMiddleware, requireRole } from '../utils/middleware.js';
import { apiRateLimit } from '../utils/rateLimiter.js';

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
    const weekData = await getWeekData(yearNumber);
    if (weekData?.length) {
      await Promise.all(weekData.map(week => dbAdminFunctions.addWeek(week)));
    }
    return c.json({ status: 'added all weeks' });
  })
  // Get Weeks for Year
  .get('/weeks', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const yearNumber = Number(c.req.query('year'));
    if (!yearNumber || isNaN(yearNumber))
      throw new HTTPException(400, { message: 'year is required' });
    const weeks = await dbAdminFunctions.returnWeeksByYear(yearNumber);
    return c.json({ weeks });
  })
  // Add Games to Week
  .post('/week', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const weekIdentifier: WeekIdentifier = await c.req.json();
    const weekQuery = await dbAdminFunctions.enrichWeekIdentifier(weekIdentifier);
    const gameData = await getGameData(weekQuery);
    if (!gameData?.length) {
      throw new HTTPException(422, {
        message: 'No games returned from external API for this week',
      });
    }
    await Promise.all(gameData.map(game => dbAdminFunctions.upsertGameForWeek(game)));
    return c.json({ status: `imported ${gameData.length} games` });
  })
  // Get Games for Week
  .get('/games', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const weekIdentifier: WeekIdentifier = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
    };
    if (isNaN(weekIdentifier.year) || isNaN(weekIdentifier.week))
      throw new HTTPException(400, { message: 'year and week are required' });
    const weekGames = await dbAdminFunctions.returnGamesForWeek(weekIdentifier);
    return c.json({ weekGames });
  })
  // Set picked games
  .post('/picks', apiRateLimit, authMiddleware, requireRole('admin'), async c => {
    const pickedData: PickedGamesRequest = await c.req.json();
    await dbAdminFunctions.setPickedGames(pickedData);
    return c.json({ status: 'updated picked games' });
  });

export default admin;
