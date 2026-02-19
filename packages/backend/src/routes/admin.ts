import { Hono } from 'hono';
import * as dbAdminFunctions from '../db/dbAdminFunctions.js';
import { returnUsers } from '../db/dbUserFunctions.js';
import { getWeekData, getGameData } from '../api/index.js';
import { ok, err } from '../utils/response.js';
import type {
  JwtData,
  ProfileData,
  WeekIdentifier,
  PickedGamesRequest,
} from '@shared/types/cfb-pickem-api.js';
import { authMiddleware, requireRole } from '../utils/middleware.js';
import logger from '../utils/logger.js';

type Variables = {
  jwtPayload: JwtData;
};

const admin = new Hono<{ Variables: Variables }>();
admin.use(authMiddleware);

// Return all users' details
admin.post('/users', requireRole('admin'), async c => {
  try {
    const allUsers = await returnUsers();
    const allUserProfiles: ProfileData[] = allUsers;
    return c.json(ok({ allUserProfiles }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    logger.error({ err: e }, 'Unexpected error in admin route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Add Weeks to Year
admin.post('/year/:year', requireRole('admin'), async c => {
  try {
    const yearNumber = Number(c.req.param('year'));
    const weekData = await getWeekData(yearNumber);
    if (weekData?.length) {
      await Promise.all(weekData.map(week => dbAdminFunctions.addWeek(week)));
    }
    return c.json(ok({ status: 'added all weeks' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    logger.error({ err: e }, 'Unexpected error in admin route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Get Weeks for Year
admin.get('/weeks', requireRole('admin'), async c => {
  try {
    const yearNumber = Number(c.req.query('year'));
    if (!yearNumber || isNaN(yearNumber)) return c.json(err('year is required', 400));
    let weeks = await dbAdminFunctions.returnWeeksByYear(yearNumber);
    if (!weeks || weeks.length === 0) {
      const weekData = await getWeekData(yearNumber);
      if (weekData?.length) {
        await Promise.all(weekData.map(week => dbAdminFunctions.addWeek(week)));
      }
      weeks = await dbAdminFunctions.returnWeeksByYear(yearNumber);
    }
    return c.json(ok({ weeks }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    logger.error({ err: e }, 'Unexpected error in admin route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Add Games to Week
admin.post('/week', requireRole('admin'), async c => {
  try {
    const weekIdentifier: WeekIdentifier = await c.req.json();
    const weekQuery = await dbAdminFunctions.enrichWeekIdentifier(weekIdentifier);
    const gameData = await getGameData(weekQuery);
    if (gameData?.length) {
      await Promise.all(gameData.map(game => dbAdminFunctions.addGameToWeek(game)));
    }
    return c.json(ok({ status: 'added all games' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    logger.error({ err: e }, 'Unexpected error in admin route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Get Games for Week
admin.get('/games', requireRole('admin'), async c => {
  try {
    const weekIdentifier: WeekIdentifier = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
    };
    if (isNaN(weekIdentifier.year) || isNaN(weekIdentifier.week))
      return c.json(err('year and week are required', 400));

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
    return c.json(ok({ weekGames }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    logger.error({ err: e }, 'Unexpected error in admin route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Set picked games
admin.post('/picks', requireRole('admin'), async c => {
  try {
    const pickedData: PickedGamesRequest = await c.req.json();
    await dbAdminFunctions.setPickedGames(pickedData);
    return c.json(ok({ status: 'updated picked games' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    logger.error({ err: e }, 'Unexpected error in admin route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

export default admin;
