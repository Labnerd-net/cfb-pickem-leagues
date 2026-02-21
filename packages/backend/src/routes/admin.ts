import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as dbAdminFunctions from '../db/dbAdminFunctions.js';
import { returnUsers } from '../db/dbUserFunctions.js';
import { getWeekData, getGameData } from '../api/index.js';
import type {
  JwtData,
  ProfileData,
  WeekIdentifier,
  PickedGamesRequest,
} from '@shared/types/cfb-pickem-api.js';
import { authMiddleware, requireRole } from '../utils/middleware.js';

type Variables = {
  jwtPayload: JwtData;
};

const admin = new Hono<{ Variables: Variables }>()
  // Return all users' details
  .get('/users', authMiddleware, requireRole('admin'), async c => {
    const allUsers = await returnUsers();
    const allUserProfiles: ProfileData[] = allUsers;
    return c.json({ allUserProfiles });
  })
  // Add Weeks to Year
  .post('/year/:year', authMiddleware, requireRole('admin'), async c => {
    const yearNumber = Number(c.req.param('year'));
    const weekData = await getWeekData(yearNumber);
    if (weekData?.length) {
      await Promise.all(weekData.map(week => dbAdminFunctions.addWeek(week)));
    }
    return c.json({ status: 'added all weeks' });
  })
  // Get Weeks for Year
  .get('/weeks', authMiddleware, requireRole('admin'), async c => {
    const yearNumber = Number(c.req.query('year'));
    if (!yearNumber || isNaN(yearNumber))
      throw new HTTPException(400, { message: 'year is required' });
    let weeks = await dbAdminFunctions.returnWeeksByYear(yearNumber);
    if (!weeks || weeks.length === 0) {
      const weekData = await getWeekData(yearNumber);
      if (weekData?.length) {
        await Promise.all(weekData.map(week => dbAdminFunctions.addWeek(week)));
      }
      weeks = await dbAdminFunctions.returnWeeksByYear(yearNumber);
    }
    return c.json({ weeks });
  })
  // Add Games to Week
  .post('/week', authMiddleware, requireRole('admin'), async c => {
    const weekIdentifier: WeekIdentifier = await c.req.json();
    const weekQuery = await dbAdminFunctions.enrichWeekIdentifier(weekIdentifier);
    const gameData = await getGameData(weekQuery);
    if (gameData?.length) {
      await Promise.all(gameData.map(game => dbAdminFunctions.addGameToWeek(game)));
    }
    return c.json({ status: 'added all games' });
  })
  // Get Games for Week
  .get('/games', authMiddleware, requireRole('admin'), async c => {
    const weekIdentifier: WeekIdentifier = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
    };
    if (isNaN(weekIdentifier.year) || isNaN(weekIdentifier.week))
      throw new HTTPException(400, { message: 'year and week are required' });

    // Auto-load weeks if they don't exist
    const existingWeeks = await dbAdminFunctions.returnWeeksByYear(weekIdentifier.year);
    if (!existingWeeks || existingWeeks.length === 0) {
      const weekData = await getWeekData(weekIdentifier.year);
      if (weekData?.length) {
        await Promise.all(weekData.map(week => dbAdminFunctions.addWeek(week)));
      }
    }

    // Try to get games from database
    let weekGames = await dbAdminFunctions.returnGamesForWeek(weekIdentifier);

    // If no games found, fetch from external api
    if (!weekGames || weekGames.length === 0) {
      const weekQuery = await dbAdminFunctions.enrichWeekIdentifier(weekIdentifier);
      const gameData = await getGameData(weekQuery);
      if (gameData?.length) {
        await Promise.all(gameData.map(game => dbAdminFunctions.addGameToWeek(game)));
      }
      weekGames = await dbAdminFunctions.returnGamesForWeek(weekIdentifier);
    }
    return c.json({ weekGames });
  })
  // Set picked games
  .post('/picks', authMiddleware, requireRole('admin'), async c => {
    const pickedData: PickedGamesRequest = await c.req.json();
    await dbAdminFunctions.setPickedGames(pickedData);
    return c.json({ status: 'updated picked games' });
  });

export default admin;
