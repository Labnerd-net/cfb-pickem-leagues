import { Hono } from 'hono';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import { ok, err } from '../utils/response.js';
import type {
  AllUserGamePicks,
  JwtData,
  ProfileData,
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
  }
});

// Get user game picks
user.get('/picks', async c => {
  try {
    const payload = c.get('jwtPayload');
    const weekData: WeekIdData = await c.req.json();
    const picks = await dbUserFunctions.returnUserGames(weekData, payload.sub);
    return c.json(ok({ picks }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
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
  }
});

export default user;
