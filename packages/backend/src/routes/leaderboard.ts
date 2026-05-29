import { Hono } from 'hono';
import { returnLeaderboard, returnWeekScores } from '../db/dbUserFunctions.js';
import { authMiddleware, requireLeagueMembership } from '../utils/middleware.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import { yearQueryValidator, weekIdentifierQueryValidator, leagueIdQueryValidator } from '../utils/zValidate.js';
import type { JwtData } from '@shared/types/cfb-pickem-api.js';

type Variables = {
  jwtPayload: JwtData;
  leagueMembership: { leagueId: number; userId: number; role: string; joinedAt: Date };
};

const leaderboard = new Hono<{ Variables: Variables }>()
  // Season-level standings (league-scoped)
  .get('/', apiRateLimit, authMiddleware, yearQueryValidator, leagueIdQueryValidator, requireLeagueMembership(), async c => {
    const year = Number(c.req.query('year'));
    const leagueId = Number(c.req.query('leagueId'));
    const entries = await returnLeaderboard(year, leagueId);
    return c.json({ leaderboard: entries });
  })
  // Per-week pick results across all users (league-scoped)
  .get('/scores', apiRateLimit, authMiddleware, weekIdentifierQueryValidator, leagueIdQueryValidator, requireLeagueMembership(), async c => {
    const year = Number(c.req.query('year'));
    const weekNumber = Number(c.req.query('weekNumber'));
    const leagueId = Number(c.req.query('leagueId'));
    const scores = await returnWeekScores(year, weekNumber, leagueId);
    return c.json({ scores });
  });

export default leaderboard;
