import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import { returnPickedGames, returnWeeksByYear, returnGame } from '../db/dbAdminFunctions.js';
import type {
  AdminDbGameData,
  AdminWeekData,
  AllUserGamePicksRequest,
  JwtData,
  ProfileData,
  WeekIdentifier,
} from '@shared/types/cfb-pickem-api.js';
import { authMiddleware } from '../utils/middleware.js';
import { ignorePickDeadline } from '../utils/envVars.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import { allUserPickedRequestValidator } from '../utils/zValidate.js';

type Variables = {
  jwtPayload: JwtData;
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
  // Get user game picks
  .get('/picks', apiRateLimit, authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const userIdString = String(payload.sub);
    const weekIdentifier: WeekIdentifier = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
    };
    if (isNaN(weekIdentifier.year) || weekIdentifier.year < 1900 || weekIdentifier.year > 2100)
      throw new HTTPException(400, { message: 'year must be between 1900 and 2100' });
    if (isNaN(weekIdentifier.week) || weekIdentifier.week < 1 || weekIdentifier.week > 52)
      throw new HTTPException(400, { message: 'week must be between 1 and 52' });
    const picks = await dbUserFunctions.returnUserGames(weekIdentifier, userIdString);
    return c.json({ picks });
  })
  // List weeks in a year with picked games
  .get('/weeks', apiRateLimit, authMiddleware, async c => {
    const yearNumber = Number(c.req.query('year'));
    if (isNaN(yearNumber) || yearNumber < 1900 || yearNumber > 2100)
      throw new HTTPException(400, { message: 'year must be between 1900 and 2100' });
    const weeks: AdminWeekData[] = await returnWeeksByYear(yearNumber);
    if (!weeks || weeks.length === 0)
      throw new HTTPException(404, { message: 'No weeks available for this year' });
    return c.json({ weeks });
  })
  // Get admin-picked games for a week
  .get('/games', apiRateLimit, authMiddleware, async c => {
    const weekIdentifier: WeekIdentifier = {
      year: Number(c.req.query('year')),
      week: Number(c.req.query('week')),
    };
    if (isNaN(weekIdentifier.year) || weekIdentifier.year < 1900 || weekIdentifier.year > 2100)
      throw new HTTPException(400, { message: 'year must be between 1900 and 2100' });
    if (isNaN(weekIdentifier.week) || weekIdentifier.week < 1 || weekIdentifier.week > 52)
      throw new HTTPException(400, { message: 'week must be between 1 and 52' });
    const pickedGames: AdminDbGameData[] = await returnPickedGames(weekIdentifier);
    if (!pickedGames || pickedGames.length === 0)
      throw new HTTPException(404, { message: 'No picked games found for this week' });
    return c.json({ pickedGames });
  })
  // Set user game picks
  .post('/picks', apiRateLimit, allUserPickedRequestValidator, authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const userIdString = String(payload.sub);
    const userPicks: AllUserGamePicksRequest = c.req.valid('json');

    if (!ignorePickDeadline) {
      const now = new Date();
      for (const pick of userPicks.games) {
        const gameRows = await returnGame(pick.game);
        if (!gameRows || gameRows.length === 0) {
          throw new HTTPException(404, { message: `Game ${pick.game} not found` });
        }
        const game = gameRows[0];
        if (game.startTime === null) {
          throw new HTTPException(422, {
            message: `Game ${pick.game} has no start time set and cannot accept picks.`,
          });
        }
        if (now >= game.startTime) {
          throw new HTTPException(422, {
            message: `Game ${pick.game} (${game.awayTeam} @ ${game.homeTeam}) is locked — kickoff has passed. Check your other picks too.`,
          });
        }
      }
    }

    for (const pick of userPicks.games) {
      await dbUserFunctions.addPickedGame(pick, userIdString);
    }
    return c.json({ status: 'updated picked games' });
  });

export default user;
