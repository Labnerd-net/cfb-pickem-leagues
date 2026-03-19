import { eq, and, sql, count } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { users, games, deletedUsers } from './schema/users.js';
import { adminGames } from './schema/admin.js';
import { db } from './index.js';
import logger from '../utils/logger.js';
import type {
  ProfileData,
  Role,
  UserData,
  UserDbData,
  UserDbGameData,
  UserGamePicks,
  UserPickHistoryEntry,
  LeaderboardEntry,
  WeekScoresEntry,
  WeekIdentifier,
} from '@shared/types/cfb-pickem-api.js';

// ------------------------------------------------------------------
// Return all users
// ------------------------------------------------------------------
export async function returnUsers(): Promise<ProfileData[]> {
  logger.debug('returnUsers');
  try {
    const rows = await db
      .select({
        userId: users.userId,
        email: users.email,
        displayName: users.displayName,
        roles: users.roles,
        emailVerified: users.emailVerified,
      })
      .from(users);
    return rows.map(r => ({ ...r, emailVerified: r.emailVerified ?? false }));
  } catch (e) {
    logger.error({ err: e }, 'returnUsers failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return total count of users ever registered (active + deleted)
// Used to determine first-user admin bootstrap — must include deleted
// accounts to prevent re-opening the admin window if the sole admin
// deletes their account.
// ------------------------------------------------------------------
export async function returnTotalUserCount(): Promise<number> {
  logger.debug('returnTotalUserCount');
  try {
    const [activeResult] = await db.select({ count: count() }).from(users);
    const [deletedResult] = await db.select({ count: count() }).from(deletedUsers);
    return (activeResult?.count ?? 0) + (deletedResult?.count ?? 0);
  } catch (e) {
    logger.error({ err: e }, 'returnTotalUserCount failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return user by Email
// ------------------------------------------------------------------
export async function returnUserByEmail(email: string): Promise<UserDbData[]> {
  logger.debug({ email }, 'returnUserByEmail');
  try {
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows.map(r => ({ ...r, emailVerified: r.emailVerified ?? false }));
  } catch (e) {
    logger.error({ err: e }, 'returnUserByEmail failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Update user roles
// ------------------------------------------------------------------
export async function updateUserRoles(userId: number, roles: Role[]): Promise<ProfileData[]> {
  logger.debug({ userId, roles }, 'updateUserRoles');
  try {
    const rows = await db
      .update(users)
      .set({ roles })
      .where(eq(users.userId, userId))
      .returning({
        userId: users.userId,
        email: users.email,
        displayName: users.displayName,
        roles: users.roles,
        emailVerified: users.emailVerified,
      });
    return rows.map(r => ({ ...r, emailVerified: r.emailVerified ?? false }));
  } catch (e) {
    logger.error({ err: e }, 'updateUserRoles failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return user by Id
// ------------------------------------------------------------------
export async function returnUserById(userId: number): Promise<UserDbData[]> {
  logger.debug({ userId }, 'returnUserById');
  try {
    const rows = await db.select().from(users).where(eq(users.userId, userId));
    return rows.map(r => ({ ...r, emailVerified: r.emailVerified ?? false }));
  } catch (e) {
    logger.error({ err: e }, 'returnUserById failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Add user
// ------------------------------------------------------------------
export async function addUser(user: UserData) {
  logger.debug({ email: user.email }, 'addUser');
  try {
    return await db
      .insert(users)
      .values({
        email: user.email,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        roles: user.roles,
      })
      .returning({
        userId: users.userId,
        email: users.email,
        displayName: users.displayName,
        roles: users.roles,
      });
  } catch (e) {
    logger.error({ err: e }, 'addUser failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Delete user and write audit record atomically
// ------------------------------------------------------------------
export async function deleteUserWithAudit(user: UserDbData): Promise<void> {
  logger.debug({ userId: user.userId }, 'deleteUserWithAudit');
  try {
    await db.transaction(async tx => {
      await tx.insert(deletedUsers).values({
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        createdAt: user.createdAt,
      });
      await tx.delete(users).where(eq(users.userId, user.userId));
    });
  } catch (e) {
    logger.error({ err: e }, 'deleteUserWithAudit failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Add Game Picks to user
// ------------------------------------------------------------------
export async function addPickedGame(pick: UserGamePicks, userId: string): Promise<void> {
  logger.debug({ game: pick.game, userId }, 'addPickedGame');
  try {
    const userIdNumber = Number(userId);
    await db
      .insert(games)
      .values({
        userId: userIdNumber,
        gameId: pick.game,
        teamChosen: pick.pick,
      })
      .onConflictDoUpdate({
        target: [games.userId, games.gameId],
        set: {
          teamChosen: pick.pick,
        },
      });
  } catch (e) {
    logger.error({ err: e }, 'addPickedGame failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Add Game Picks to user (batch, transactional)
// ------------------------------------------------------------------
export async function addPickedGamesBatch(picks: UserGamePicks[], userId: string): Promise<void> {
  logger.debug({ count: picks.length, userId }, 'addPickedGamesBatch');
  try {
    const userIdNumber = Number(userId);
    await db.transaction(async tx => {
      for (const pick of picks) {
        await tx
          .insert(games)
          .values({
            userId: userIdNumber,
            gameId: pick.game,
            teamChosen: pick.pick,
          })
          .onConflictDoUpdate({
            target: [games.userId, games.gameId],
            set: {
              teamChosen: pick.pick,
            },
          });
      }
    });
  } catch (e) {
    logger.error({ err: e }, 'addPickedGamesBatch failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return User Pick History (per-week summary for a year)
// ------------------------------------------------------------------
export async function returnUserPickHistory(
  year: number,
  userId: string
): Promise<UserPickHistoryEntry[]> {
  const userIdNumber = Number(userId);
  logger.debug({ year, userId }, 'returnUserPickHistory');
  try {
    const rows = await db
      .select({
        year: adminGames.year,
        weekNumber: adminGames.weekNumber,
        total: sql<number>`COUNT(*)`,
        correct: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} != 'pending' AND ${adminGames.winningTeam} = ${games.teamChosen} THEN 1 END)`,
        incorrect: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} != 'pending' AND ${adminGames.winningTeam} != ${games.teamChosen} THEN 1 END)`,
        pending: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} = 'pending' THEN 1 END)`,
      })
      .from(games)
      .innerJoin(adminGames, eq(games.gameId, adminGames.gameId))
      .where(and(eq(adminGames.year, year), eq(games.userId, userIdNumber)))
      .groupBy(adminGames.year, adminGames.weekNumber)
      .orderBy(sql`${adminGames.weekNumber} DESC`);
    return rows.map(r => ({
      year: r.year,
      weekNumber: r.weekNumber,
      total: Number(r.total),
      correct: Number(r.correct),
      incorrect: Number(r.incorrect),
      pending: Number(r.pending),
    }));
  } catch (e) {
    logger.error({ err: e }, 'returnUserPickHistory failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return season-level leaderboard (all users, LEFT JOIN so zero-pick users appear)
// ------------------------------------------------------------------
export async function returnLeaderboard(year: number): Promise<LeaderboardEntry[]> {
  logger.debug({ year }, 'returnLeaderboard');
  // Alias user.games to avoid a table-name collision with admin.games in the same query
  const userGames = alias(games, 'user_games');
  try {
    const rows = await db
      .select({
        userId: users.userId,
        displayName: users.displayName,
        total: sql<number>`COUNT(${adminGames.gameId})`,
        correct: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} != 'pending' AND ${adminGames.winningTeam} = ${userGames.teamChosen} THEN 1 END)`,
        incorrect: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} != 'pending' AND ${adminGames.winningTeam} != ${userGames.teamChosen} THEN 1 END)`,
        pending: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} = 'pending' THEN 1 END)`,
      })
      .from(users)
      .leftJoin(userGames, eq(users.userId, userGames.userId))
      .leftJoin(adminGames, and(eq(userGames.gameId, adminGames.gameId), eq(adminGames.year, year)))
      .groupBy(users.userId, users.displayName)
      .orderBy(
        sql`COUNT(CASE WHEN ${adminGames.winningTeam} != 'pending' AND ${adminGames.winningTeam} = ${userGames.teamChosen} THEN 1 END) DESC`
      );
    return rows.map(r => {
      const correct = Number(r.correct);
      const incorrect = Number(r.incorrect);
      const finished = correct + incorrect;
      return {
        userId: r.userId,
        displayName: r.displayName,
        total: finished,
        correct,
        incorrect,
        pending: Number(r.pending),
        percentage: finished === 0 ? null : correct / finished,
      };
    });
  } catch (e) {
    logger.error({ err: e }, 'returnLeaderboard failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return per-week scores across all users who made picks for a week
// ------------------------------------------------------------------
export async function returnWeekScores(year: number, week: number): Promise<WeekScoresEntry[]> {
  logger.debug({ year, week }, 'returnWeekScores');
  try {
    const rows = await db
      .select({
        userId: users.userId,
        displayName: users.displayName,
        total: sql<number>`COUNT(*)`,
        correct: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} != 'pending' AND ${adminGames.winningTeam} = ${games.teamChosen} THEN 1 END)`,
        incorrect: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} != 'pending' AND ${adminGames.winningTeam} != ${games.teamChosen} THEN 1 END)`,
        pending: sql<number>`COUNT(CASE WHEN ${adminGames.winningTeam} = 'pending' THEN 1 END)`,
      })
      .from(games)
      .innerJoin(
        adminGames,
        and(
          eq(games.gameId, adminGames.gameId),
          eq(adminGames.year, year),
          eq(adminGames.weekNumber, week)
        )
      )
      .innerJoin(users, eq(games.userId, users.userId))
      .groupBy(users.userId, users.displayName);
    return rows.map(r => ({
      userId: r.userId,
      displayName: r.displayName,
      total: Number(r.total),
      correct: Number(r.correct),
      incorrect: Number(r.incorrect),
      pending: Number(r.pending),
    }));
  } catch (e) {
    logger.error({ err: e }, 'returnWeekScores failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return count of picks a user has made for a given week
// ------------------------------------------------------------------
export async function returnUserPickCount(
  userId: number,
  year: number,
  weekNumber: number
): Promise<number> {
  logger.debug({ userId, year, weekNumber }, 'returnUserPickCount');
  try {
    const rows = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(games)
      .innerJoin(
        adminGames,
        and(
          eq(games.gameId, adminGames.gameId),
          eq(adminGames.year, year),
          eq(adminGames.weekNumber, weekNumber)
        )
      )
      .where(eq(games.userId, userId));
    return Number(rows[0]?.count ?? 0);
  } catch (e) {
    logger.error({ err: e }, 'returnUserPickCount failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return User Games
// ------------------------------------------------------------------
export async function returnUserGames(
  identifier: WeekIdentifier,
  userId: string
): Promise<UserDbGameData[]> {
  const userIdNumber = Number(userId);
  logger.debug({ year: identifier.year, week: identifier.week, userId }, 'returnUserGames');
  try {
    return await db
      .select({
        gameId: adminGames.gameId,
        cfbdGameId: adminGames.cfbdGameId,
        ncaaGameId: adminGames.ncaaGameId,
        weekNumber: adminGames.weekNumber,
        year: adminGames.year,
        seasonType: adminGames.seasonType,
        completed: adminGames.completed,
        homeTeam: adminGames.homeTeam,
        awayTeam: adminGames.awayTeam,
        homePoints: adminGames.homePoints,
        awayPoints: adminGames.awayPoints,
        winningTeam: adminGames.winningTeam,
        startTime: adminGames.startTime,
        userId: games.userId,
        teamChosen: games.teamChosen,
        createdAt: games.createdAt,
      })
      .from(games)
      .innerJoin(adminGames, eq(games.gameId, adminGames.gameId))
      .where(
        and(
          eq(adminGames.year, identifier.year),
          eq(adminGames.weekNumber, identifier.week),
          eq(games.userId, userIdNumber)
        )
      );
  } catch (e) {
    logger.error({ err: e }, 'returnUserGames failed');
    throw e;
  }
}
