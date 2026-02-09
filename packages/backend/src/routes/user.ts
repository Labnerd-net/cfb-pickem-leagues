import { Hono } from 'hono';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import { returnPickedGames } from '../db/dbAdminFunctions.js';
import { ok, err } from '../utils/response.js';
import type {
  AdminDbGameData,
  AllUserGamePicks,
  JwtData,
  ProfileData,
  SeasonType,
  WeekIdData,
} from '@shared/types/cfb-pickem-api.js';
import { authMiddleware } from '../utils/middleware.js';

type Variables = {
  jwtPayload: JwtData;
};

const user = new Hono<{ Variables: Variables }>();
user.use(authMiddleware);

// Show user info
user.get('/profile', async c => {
  try {
    const payload = c.get('jwtPayload');
    const user = await dbUserFunctions.returnUserById(payload.sub);
    if (!user || user.length !== 1) {
      return c.json(err('User not found', 404));
    }
    const profile: ProfileData = user[0];
    return c.json(ok(profile));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Get user game picks
user.get('/picks', async c => {
  try {
    const payload = c.get('jwtPayload');
    const weekData: WeekIdData = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
      seasonType: (c.req.query('seasonType') || 'regular') as SeasonType,
    };
    const picks = await dbUserFunctions.returnUserGames(weekData, payload.sub);
    return c.json(ok({ picks }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Get admin-picked games for a week
user.get('/games', async c => {
  try {
    const weekData: WeekIdData = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
      seasonType: (c.req.query('seasonType') || 'regular') as SeasonType,
    };
    const pickedGames: AdminDbGameData[] = await returnPickedGames(weekData);
    if (!pickedGames || pickedGames.length === 0) {
      return c.json(err('No picked games found for this week', 404));
    }
    return c.json(ok({ pickedGames }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred', 500));
  }
});

// Set user game picks
user.post('/picks', async c => {
  try {
    const payload = c.get('jwtPayload');
    const userPicks: AllUserGamePicks = await c.req.json();
    for (const pick of userPicks.games) {
      await dbUserFunctions.addPickedGame(pick, payload.sub);
    }
    return c.json(ok({ status: 'updated picked games' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred', 500));
  }
});

export default user;
