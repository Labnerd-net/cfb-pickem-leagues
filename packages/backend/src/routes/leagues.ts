import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { JwtData } from '@shared/types/cfb-pickem-api.js';
import { authMiddleware, requireRole, requireLeagueMembership } from '../utils/middleware.js';
import { apiRateLimit } from '../utils/rateLimiter.js';
import {
  createLeagueValidator,
  joinLeagueValidator,
  leagueIdParamValidator,
  memberParamValidator,
  updateMemberRoleValidator,
} from '../utils/zValidate.js';
import {
  createLeague,
  getLeaguesForUser,
  getLeagueById,
  getLeagueByInviteCode,
  getLeagueMembership,
  joinLeague,
  getLeagueMembers,
  getLeagueMemberCount,
  getLeagueAdminCount,
  updateMemberRole,
  removeMember,
  regenerateInviteCode,
} from '../db/dbLeagueFunctions.js';

type Variables = {
  jwtPayload: JwtData;
  leagueMembership: { leagueId: number; userId: number; role: string; joinedAt: Date };
};

const leaguesRoute = new Hono<{ Variables: Variables }>()

  // Create a new league (site admin only)
  .post('/', apiRateLimit, authMiddleware, requireRole('admin'), createLeagueValidator, async c => {
    const payload = c.get('jwtPayload');
    const { name } = c.req.valid('json');
    const league = await createLeague(name, payload.sub);
    const memberCount = await getLeagueMemberCount(league.leagueId);
    return c.json(
      {
        league: {
          leagueId: league.leagueId,
          name: league.name,
          inviteCode: league.inviteCode,
          memberCount,
          createdAt: league.createdAt.toISOString(),
          role: 'admin' as const,
        },
      },
      201
    );
  })

  // List leagues the current user belongs to
  .get('/', apiRateLimit, authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const rows = await getLeaguesForUser(payload.sub);
    const leagues = rows.map(r => ({
      leagueId: r.leagueId,
      name: r.name,
      inviteCode: r.role === 'admin' ? r.inviteCode : undefined,
      memberCount: r.memberCount ?? 0,
      createdAt: r.createdAt.toISOString(),
      role: r.role as 'admin' | 'member',
    }));
    return c.json({ leagues });
  })

  // Join a league via invite code — must come before /:leagueId routes
  .post('/join', apiRateLimit, authMiddleware, joinLeagueValidator, async c => {
    const payload = c.get('jwtPayload');
    const { inviteCode } = c.req.valid('json');

    const league = await getLeagueByInviteCode(inviteCode);
    if (!league) throw new HTTPException(404, { message: 'Invalid invite code' });

    const existing = await getLeagueMembership(league.leagueId, payload.sub);
    if (existing) throw new HTTPException(409, { message: 'Already a member of this league' });

    await joinLeague(league.leagueId, payload.sub);
    const memberCount = await getLeagueMemberCount(league.leagueId);
    return c.json({
      league: {
        leagueId: league.leagueId,
        name: league.name,
        memberCount,
        createdAt: league.createdAt.toISOString(),
        role: 'member' as const,
      },
    });
  })

  // Get a single league (members see it; admins also get invite code)
  .get('/:leagueId', apiRateLimit, authMiddleware, leagueIdParamValidator, requireLeagueMembership(), async c => {
    const membership = c.get('leagueMembership');
    const league = await getLeagueById(membership.leagueId);
    const memberCount = await getLeagueMemberCount(membership.leagueId);
    return c.json({
      league: {
        leagueId: league.leagueId,
        name: league.name,
        inviteCode: membership.role === 'admin' ? league.inviteCode : undefined,
        memberCount,
        createdAt: league.createdAt.toISOString(),
        role: membership.role as 'admin' | 'member',
      },
    });
  })

  // List members of a league
  .get('/:leagueId/members', apiRateLimit, authMiddleware, leagueIdParamValidator, requireLeagueMembership(), async c => {
    const membership = c.get('leagueMembership');
    const rows = await getLeagueMembers(membership.leagueId);
    const members = rows.map(m => ({
      userId: m.userId,
      displayName: m.displayName,
      role: m.role as 'admin' | 'member',
      joinedAt: m.joinedAt.toISOString(),
    }));
    return c.json({ members });
  })

  // Change a member's role (league admin only)
  .patch(
    '/:leagueId/members/:userId',
    apiRateLimit,
    authMiddleware,
    memberParamValidator,
    requireLeagueMembership('admin'),
    updateMemberRoleValidator,
    async c => {
      const { leagueId, userId } = c.req.valid('param');
      const { role } = c.req.valid('json');

      if (role === 'member') {
        const adminCount = await getLeagueAdminCount(leagueId);
        if (adminCount <= 1) {
          throw new HTTPException(409, { message: 'Cannot demote the only admin of a league' });
        }
      }

      const updated = await updateMemberRole(leagueId, userId, role);
      if (!updated) throw new HTTPException(404, { message: 'Member not found' });
      return c.json({
        member: {
          userId: updated.userId,
          role: updated.role as 'admin' | 'member',
          joinedAt: updated.joinedAt.toISOString(),
        },
      });
    }
  )

  // Remove a member from a league (league admin only)
  .delete(
    '/:leagueId/members/:userId',
    apiRateLimit,
    authMiddleware,
    memberParamValidator,
    requireLeagueMembership('admin'),
    async c => {
      const { leagueId, userId } = c.req.valid('param');

      const targetMembership = await getLeagueMembership(leagueId, userId);
      if (targetMembership?.role === 'admin') {
        const adminCount = await getLeagueAdminCount(leagueId);
        if (adminCount <= 1) {
          throw new HTTPException(409, { message: 'Cannot remove the only admin of a league' });
        }
      }

      await removeMember(leagueId, userId);
      return c.json({ success: true });
    }
  )

  // Regenerate invite code (league admin only)
  .post(
    '/:leagueId/invite/regenerate',
    apiRateLimit,
    authMiddleware,
    leagueIdParamValidator,
    requireLeagueMembership('admin'),
    async c => {
      const membership = c.get('leagueMembership');
      const newCode = await regenerateInviteCode(membership.leagueId);
      return c.json({ inviteCode: newCode });
    }
  );

export default leaguesRoute;
