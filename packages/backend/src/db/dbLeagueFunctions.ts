import { randomBytes } from 'crypto';
import { eq, and, count } from 'drizzle-orm';
import { leagues, leagueMembers, leagueGames } from './schema/leagues.js';
import { users } from './schema/users.js';
import { db } from './index.js';
import logger from '../utils/logger.js';
import type { LeagueRole } from '@shared/types/cfb-pickem-api.js';

function generateInviteCode(): string {
  return randomBytes(4).toString('hex');
}

export async function createLeague(name: string, createdBy: number) {
  try {
    const [league] = await db
      .insert(leagues)
      .values({ name, inviteCode: generateInviteCode(), createdBy })
      .returning();
    await db.insert(leagueMembers).values({ leagueId: league.leagueId, userId: createdBy, role: 'admin' });
    return league;
  } catch (err) {
    logger.error({ err }, 'createLeague failed');
    throw err;
  }
}

export async function getLeaguesForUser(userId: number) {
  try {
    const memberCountSq = db
      .select({ leagueId: leagueMembers.leagueId, memberCount: count().as('member_count') })
      .from(leagueMembers)
      .groupBy(leagueMembers.leagueId)
      .as('member_counts');

    return await db
      .select({
        leagueId: leagues.leagueId,
        name: leagues.name,
        inviteCode: leagues.inviteCode,
        createdAt: leagues.createdAt,
        role: leagueMembers.role,
        memberCount: memberCountSq.memberCount,
      })
      .from(leagueMembers)
      .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.leagueId))
      .leftJoin(memberCountSq, eq(leagues.leagueId, memberCountSq.leagueId))
      .where(eq(leagueMembers.userId, userId));
  } catch (err) {
    logger.error({ err }, 'getLeaguesForUser failed');
    throw err;
  }
}

export async function getLeagueById(leagueId: number) {
  try {
    const [league] = await db.select().from(leagues).where(eq(leagues.leagueId, leagueId));
    return league;
  } catch (err) {
    logger.error({ err }, 'getLeagueById failed');
    throw err;
  }
}

export async function getLeagueByInviteCode(inviteCode: string) {
  try {
    const [league] = await db.select().from(leagues).where(eq(leagues.inviteCode, inviteCode));
    return league;
  } catch (err) {
    logger.error({ err }, 'getLeagueByInviteCode failed');
    throw err;
  }
}

export async function getLeagueMembership(leagueId: number, userId: number) {
  try {
    const [membership] = await db
      .select()
      .from(leagueMembers)
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)));
    return membership;
  } catch (err) {
    logger.error({ err }, 'getLeagueMembership failed');
    throw err;
  }
}

export async function joinLeague(leagueId: number, userId: number) {
  try {
    const [membership] = await db
      .insert(leagueMembers)
      .values({ leagueId, userId, role: 'member' })
      .returning();
    return membership;
  } catch (err) {
    logger.error({ err }, 'joinLeague failed');
    throw err;
  }
}

export async function getLeagueMembers(leagueId: number) {
  try {
    return await db
      .select({
        userId: leagueMembers.userId,
        displayName: users.displayName,
        role: leagueMembers.role,
        joinedAt: leagueMembers.joinedAt,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(leagueMembers.userId, users.userId))
      .where(eq(leagueMembers.leagueId, leagueId));
  } catch (err) {
    logger.error({ err }, 'getLeagueMembers failed');
    throw err;
  }
}

export async function getLeagueMemberCount(leagueId: number): Promise<number> {
  try {
    const [{ value }] = await db
      .select({ value: count() })
      .from(leagueMembers)
      .where(eq(leagueMembers.leagueId, leagueId));
    return value;
  } catch (err) {
    logger.error({ err }, 'getLeagueMemberCount failed');
    throw err;
  }
}

export async function getLeagueAdminCount(leagueId: number): Promise<number> {
  try {
    const [{ value }] = await db
      .select({ value: count() })
      .from(leagueMembers)
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.role, 'admin')));
    return value;
  } catch (err) {
    logger.error({ err }, 'getLeagueAdminCount failed');
    throw err;
  }
}

export async function updateMemberRole(leagueId: number, userId: number, role: LeagueRole) {
  try {
    const [updated] = await db
      .update(leagueMembers)
      .set({ role })
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)))
      .returning();
    return updated;
  } catch (err) {
    logger.error({ err }, 'updateMemberRole failed');
    throw err;
  }
}

export async function removeMember(leagueId: number, userId: number) {
  try {
    await db
      .delete(leagueMembers)
      .where(and(eq(leagueMembers.leagueId, leagueId), eq(leagueMembers.userId, userId)));
  } catch (err) {
    logger.error({ err }, 'removeMember failed');
    throw err;
  }
}

export async function updateLeagueName(leagueId: number, name: string): Promise<boolean> {
  try {
    const result = await db.update(leagues).set({ name }).where(eq(leagues.leagueId, leagueId));
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    logger.error({ err }, 'updateLeagueName failed');
    throw err;
  }
}

export async function regenerateInviteCode(leagueId: number): Promise<string> {
  try {
    const newCode = generateInviteCode();
    await db.update(leagues).set({ inviteCode: newCode }).where(eq(leagues.leagueId, leagueId));
    return newCode;
  } catch (err) {
    logger.error({ err }, 'regenerateInviteCode failed');
    throw err;
  }
}

// ------------------------------------------------------------------
// Return all leagueIds that contain a specific game.
// Used after global score corrections to dispatch per-league.
// ------------------------------------------------------------------
export async function getLeaguesForGame(gameId: number): Promise<{ leagueId: number }[]> {
  try {
    return await db
      .select({ leagueId: leagueGames.leagueId })
      .from(leagueGames)
      .where(eq(leagueGames.gameId, gameId));
  } catch (err) {
    logger.error({ err }, 'getLeaguesForGame failed');
    throw err;
  }
}
