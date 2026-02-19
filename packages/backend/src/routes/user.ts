import { Hono } from 'hono';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import { returnPickedGames, returnWeeksByYear } from '../db/dbAdminFunctions.js';
import { ok, err } from '../utils/response.js';
import type {
  AdminDbGameData,
  AdminWeekData,
  AllUserGamePicks,
  JwtData,
  ProfileData,
  WeekIdentifier,
} from '@shared/types/cfb-pickem-api.js';
import { authMiddleware } from '../utils/middleware.js';
import logger from '../utils/logger.js';

type Variables = {
  jwtPayload: JwtData;
};

const user = new Hono<{ Variables: Variables }>();
user.use(authMiddleware);

// Show user info
user.get('/profile', async c => {
  try {
    const payload = c.get('jwtPayload');
    const userIdString = String(payload.sub);
    const user = await dbUserFunctions.returnUserById(userIdString);
    if (!user || user.length !== 1) {
      return c.json(err('User not found', 404));
    }
    const profile: ProfileData = user[0];
    return c.json(ok(profile));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    logger.error({ err: e }, 'Unexpected error in user route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Get user game picks
user.get('/picks', async c => {
  try {
    const payload = c.get('jwtPayload');
    const userIdString = String(payload.sub);
    const weekIdentifier: WeekIdentifier = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
    };
    if (isNaN(weekIdentifier.year) || isNaN(weekIdentifier.week))
      return c.json(err('year and week are required', 400));
    const picks = await dbUserFunctions.returnUserGames(weekIdentifier, userIdString);
    return c.json(ok({ picks }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    logger.error({ err: e }, 'Unexpected error in user route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

// List weeks in a year with picked games
user.get('/weeks', async c => {
  try {
    const yearNumber = Number(c.req.query('year'));
    if (isNaN(yearNumber)) return c.json(err('year is required', 400));
    const weeks: AdminWeekData[] = await returnWeeksByYear(yearNumber);
    if (!weeks || weeks.length === 0) {
      return c.json(err('No weeks available for this year', 404));
    }
    return c.json(ok({ weeks }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    logger.error({ err: e }, 'Unexpected error in user route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Get admin-picked games for a week
user.get('/games', async c => {
  try {
    const weekIdentifier: WeekIdentifier = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
    };
    if (isNaN(weekIdentifier.year) || isNaN(weekIdentifier.week))
      return c.json(err('year and week are required', 400));
    const pickedGames: AdminDbGameData[] = await returnPickedGames(weekIdentifier);
    if (!pickedGames || pickedGames.length === 0)
      return c.json(err('No picked games found for this week', 404));
    return c.json(ok({ pickedGames }));
  } catch (e: unknown) {
    if (e instanceof Error) return c.json(err(e.message, 500));
    logger.error({ err: e }, 'Unexpected error in user route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Set user game picks
user.post('/picks', async c => {
  try {
    const payload = c.get('jwtPayload');
    const userIdString = String(payload.sub);
    const userPicks: AllUserGamePicks = await c.req.json();
    for (const pick of userPicks.games) {
      await dbUserFunctions.addPickedGame(pick, userIdString);
    }
    return c.json(ok({ status: 'updated picked games' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    logger.error({ err: e }, 'Unexpected error in user route');
    return c.json(err('An unexpected error occurred', 500));
  }
});

export default user;
