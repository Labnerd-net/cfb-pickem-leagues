import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import { returnPickedGames, returnWeeksByYear } from '../db/dbAdminFunctions.js';
import type {
  AdminDbGameData,
  AdminWeekData,
  AllUserGamePicks,
  JwtData,
  ProfileData,
  WeekIdentifier,
} from '@shared/types/cfb-pickem-api.js';
import { authMiddleware } from '../utils/middleware.js';

type Variables = {
  jwtPayload: JwtData;
};

const user = new Hono<{ Variables: Variables }>()
  // Show user info
  .get('/profile', authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const userIdString = String(payload.sub);
    const userData = await dbUserFunctions.returnUserById(userIdString);
    if (!userData || userData.length !== 1)
      throw new HTTPException(404, { message: 'User not found' });
    const profile: ProfileData = userData[0];
    return c.json(profile);
  })
  // Get user game picks
  .get('/picks', authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const userIdString = String(payload.sub);
    const weekIdentifier: WeekIdentifier = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
    };
    if (isNaN(weekIdentifier.year) || isNaN(weekIdentifier.week))
      throw new HTTPException(400, { message: 'year and week are required' });
    const picks = await dbUserFunctions.returnUserGames(weekIdentifier, userIdString);
    return c.json({ picks });
  })
  // List weeks in a year with picked games
  .get('/weeks', authMiddleware, async c => {
    const yearNumber = Number(c.req.query('year'));
    if (isNaN(yearNumber)) throw new HTTPException(400, { message: 'year is required' });
    const weeks: AdminWeekData[] = await returnWeeksByYear(yearNumber);
    if (!weeks || weeks.length === 0)
      throw new HTTPException(404, { message: 'No weeks available for this year' });
    return c.json({ weeks });
  })
  // Get admin-picked games for a week
  .get('/games', authMiddleware, async c => {
    const weekIdentifier: WeekIdentifier = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
    };
    if (isNaN(weekIdentifier.year) || isNaN(weekIdentifier.week))
      throw new HTTPException(400, { message: 'year and week are required' });
    const pickedGames: AdminDbGameData[] = await returnPickedGames(weekIdentifier);
    if (!pickedGames || pickedGames.length === 0)
      throw new HTTPException(404, { message: 'No picked games found for this week' });
    return c.json({ pickedGames });
  })
  // Set user game picks
  .post('/picks', authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const userIdString = String(payload.sub);
    const userPicks: AllUserGamePicks = await c.req.json();
    for (const pick of userPicks.games) {
      await dbUserFunctions.addPickedGame(pick, userIdString);
    }
    return c.json({ status: 'updated picked games' });
  });

export default user;
