import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { JwtData } from '@shared/types/cfb-pickem-api.js';
import { authMiddleware, requireLeagueMembership } from '../utils/middleware.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import {
  leagueIdParamValidator,
  leagueGameParamValidator,
  weekIdentifierQueryValidator,
} from '../utils/zValidate.js';
import {
  getGlobalGamesWithLeagueStatus,
  addGameToLeague,
  removeGameFromLeague,
} from '../db/dbAdminFunctions.js';

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
  );

export default adminLeagues;
