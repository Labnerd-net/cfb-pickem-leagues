import { Hono } from 'hono';
import * as dbAdminFunctions from '../db/dbAdminFunctions.js';
import { returnUsers } from '../db/dbUserFunctions.js';
import { getWeekData, getGameData } from '../api/index.js';
import { ok, err } from '../utils/response.js';
import type {
  JwtData,
  PickedGamesData,
  ProfileData,
  SeasonType,
  WeekQuery,
} from '@shared/types/cfb-pickem-api.js';
import { authMiddleware, requireRole } from '../utils/middleware.js';

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
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Add Weeks to Year
admin.post('/year/:year', requireRole('admin'), async c => {
  try {
    // const payload = c.get('jwtPayload')
    // const user = await dbUserFunctions.returnUserById(payload.sub);
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
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Add Games to Week
admin.post('/week', requireRole('admin'), async c => {
  try {
    const pickedData: WeekQuery = await c.req.json();
    const gameData = await getGameData(pickedData);
    if (gameData?.length) {
      await Promise.all(gameData.map(game => dbAdminFunctions.addGameToWeek(game)));
    }
    return c.json(ok({ status: 'added all games' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Get Games for Week
admin.get('/getgames', requireRole('admin'), async c => {
  try {
    const weekData: WeekQuery = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
      seasonType: (c.req.query('seasonType') || 'regular') as SeasonType,
    };
    const weekGames = await dbAdminFunctions.returnGamesForWeek(weekData);
    if (!weekGames || weekGames.length === 0) {
      return c.json(err('No games found for this week', 404));
    }
    return c.json(ok({ weekGames }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Set picked games
admin.post('/setpicks', requireRole('admin'), async c => {
  try {
    const pickedData: PickedGamesData = await c.req.json();
    await dbAdminFunctions.setPickedGame(pickedData.games);
    return c.json(ok({ status: 'updated picked games' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred', 500));
  }
});

export default admin;
