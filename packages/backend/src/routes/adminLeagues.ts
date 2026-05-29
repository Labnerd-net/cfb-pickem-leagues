import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { JwtData } from '@shared/types/cfb-pickem-api.js';
import { authMiddleware, requireLeagueMembership } from '../utils/middleware.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import {
  leagueIdParamValidator,
  leagueGameParamValidator,
  weekIdentifierQueryValidator,
  correctGameScoreBodyValidator,
} from '../utils/zValidate.js';
import {
  getGlobalGamesWithLeagueStatus,
  addGameToLeague,
  removeGameFromLeague,
  getGamesForLeagueWeek,
  markGameComplete,
  correctGameScore,
} from '../db/dbAdminFunctions.js';
import logger from '../utils/logger.js';

type Variables = {
  jwtPayload: JwtData;
  leagueMembership: { leagueId: number; userId: number; role: string; joinedAt: Date };
};

const adminLeagues = new Hono<{ Variables: Variables }>()

  // Get full game cache for a week annotated with inLeague status
  .get(
    '/:leagueId/games',
    apiRateLimit,
    authMiddleware,
    leagueIdParamValidator,
    requireLeagueMembership('admin'),
    weekIdentifierQueryValidator,
    async c => {
      const { leagueId } = c.req.valid('param');
      const { year, weekNumber } = c.req.valid('query');
      const games = await getGlobalGamesWithLeagueStatus(leagueId, year, weekNumber);
      return c.json({ games });
    }
  )

  // Add a game to the league pool — must come before /:leagueId/games/:gameId to avoid ambiguity
  .post(
    '/:leagueId/games/complete',
    apiRateLimit,
    authMiddleware,
    leagueIdParamValidator,
    requireLeagueMembership('admin'),
    weekIdentifierQueryValidator,
    async c => {
      const { leagueId } = c.req.valid('param');
      const { year, weekNumber } = c.req.valid('query');
      const leagueGameList = await getGamesForLeagueWeek(leagueId, year, weekNumber);
      if (leagueGameList.length === 0)
        throw new HTTPException(422, { message: 'No games in league pool for this week' });

      const results = await Promise.allSettled(
        leagueGameList
          .filter(g => !g.completed && g.homePoints !== null && g.awayPoints !== null)
          .map(g => markGameComplete(g.gameId, g.homePoints!, g.awayPoints!))
      );
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0)
        logger.error({ count: failed.length }, 'Some games failed to mark complete');

      // Phase 6 will dispatch rankings_updated per league once all games are complete
      return c.json({ completed: results.length - failed.length });
    }
  )

  // Add a game to the league's pool
  .post(
    '/:leagueId/games/:gameId',
    apiRateLimit,
    authMiddleware,
    leagueGameParamValidator,
    requireLeagueMembership('admin'),
    async c => {
      const { leagueId, gameId } = c.req.valid('param');
      try {
        await addGameToLeague(leagueId, gameId);
      } catch (e: unknown) {
        const err = e as { status?: number; message?: string };
        if (err.status === 404) throw new HTTPException(404, { message: err.message });
        if (err.status === 409) throw new HTTPException(409, { message: err.message });
        throw e;
      }
      return c.json({ success: true }, 201);
    }
  )

  // Remove a game from the league's pool
  .delete(
    '/:leagueId/games/:gameId',
    apiRateLimit,
    authMiddleware,
    leagueGameParamValidator,
    requireLeagueMembership('admin'),
    async c => {
      const { leagueId, gameId } = c.req.valid('param');
      try {
        await removeGameFromLeague(leagueId, gameId);
      } catch (e: unknown) {
        const err = e as { status?: number; message?: string };
        if (err.status === 409) throw new HTTPException(409, { message: err.message });
        throw e;
      }
      return c.json({ success: true });
    }
  )

  // Score correction for a game in the league's pool (global fact; audit logged)
  .patch(
    '/:leagueId/games/:gameId/score',
    apiRateLimit,
    authMiddleware,
    leagueGameParamValidator,
    requireLeagueMembership('admin'),
    correctGameScoreBodyValidator,
    async c => {
      const { gameId } = c.req.valid('param');
      const { homePoints, awayPoints } = c.req.valid('json');
      const correctedBy = c.get('jwtPayload').sub;

      const updated = await correctGameScore(gameId, homePoints, awayPoints, correctedBy);
      if (!updated) throw new HTTPException(404, { message: 'Game not found' });

      // Phase 6 will dispatch rankings_updated per league
      return c.json({ game: updated });
    }
  );

export default adminLeagues;
