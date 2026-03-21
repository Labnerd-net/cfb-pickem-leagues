import { Hono } from 'hono';
import { returnLeaderboard, returnWeekScores } from '../db/dbUserFunctions.js';
import { authMiddleware } from '../utils/middleware.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import { yearQueryValidator, weekIdentifierQueryValidator } from '../utils/zValidate.js';
import type { JwtData } from '@shared/types/cfb-pickem-api.js';

type Variables = {
  jwtPayload: JwtData;
};

const leaderboard = new Hono<{ Variables: Variables }>()
  // Season-level standings
  .get('/', apiRateLimit, authMiddleware, yearQueryValidator, async c => {
    const { year } = c.req.valid('query');
    const entries = await returnLeaderboard(year);
    return c.json({ leaderboard: entries });
  })
  // Per-week pick results across all users
  .get('/scores', apiRateLimit, authMiddleware, weekIdentifierQueryValidator, async c => {
    const { year, weekNumber } = c.req.valid('query');
    const scores = await returnWeekScores(year, weekNumber);
    return c.json({ scores });
  });

export default leaderboard;
