import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { returnLeaderboard, returnWeekScores } from '../db/dbUserFunctions.js';
import { authMiddleware } from '../utils/middleware.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import type { JwtData } from '@shared/types/cfb-pickem-api.js';

type Variables = {
  jwtPayload: JwtData;
};

const leaderboard = new Hono<{ Variables: Variables }>()
  // Season-level standings
  .get('/', apiRateLimit, authMiddleware, async c => {
    const yearNumber = Number(c.req.query('year'));
    if (isNaN(yearNumber) || yearNumber < 1900 || yearNumber > 2100)
      throw new HTTPException(400, { message: 'year must be between 1900 and 2100' });
    const entries = await returnLeaderboard(yearNumber);
    return c.json({ leaderboard: entries });
  })
  // Per-week pick results across all users
  .get('/scores', apiRateLimit, authMiddleware, async c => {
    const yearNumber = Number(c.req.query('year'));
    if (isNaN(yearNumber) || yearNumber < 1900 || yearNumber > 2100)
      throw new HTTPException(400, { message: 'year must be between 1900 and 2100' });
    const weekNumber = Number(c.req.query('week'));
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 52)
      throw new HTTPException(400, { message: 'week must be between 1 and 52' });
    const scores = await returnWeekScores(yearNumber, weekNumber);
    return c.json({ scores });
  });

export default leaderboard;
