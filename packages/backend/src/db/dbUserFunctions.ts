import { eq, and, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { users, games, deletedUsers } from './schema/users.js';
import { adminGames } from './schema/admin.js';
import { db } from './index.js';
import * as dbAdminFunctions from './dbAdminFunctions.js';
import logger from '../utils/logger.js';
import type {
  ProfileData,
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
    return await db
      .select({
        userId: users.userId,
        email: users.email,
        displayName: users.displayName,
        roles: users.roles,
      })
      .from(users);
  } catch (e) {
    logger.error({ err: e }, 'returnUsers failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return user by Email
// ------------------------------------------------------------------
export async function returnUserByEmail(email: string): Promise<UserDbData[]> {
  logger.debug({ email }, 'returnUserByEmail');
  try {
    return await db.select().from(users).where(eq(users.email, email));
  } catch (e) {
    logger.error({ err: e }, 'returnUserByEmail failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return user by Id
// ------------------------------------------------------------------
export async function returnUserById(userId: number): Promise<UserDbData[]> {
  logger.debug({ userId }, 'returnUserById');
  try {
    return await db.select().from(users).where(eq(users.userId, userId));
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
    const gameInfo = await dbAdminFunctions.returnGame(pick.game);
    if (!gameInfo || gameInfo.length === 0) {
      throw new Error("Game Doesn't Exist");
    }
    if (gameInfo.length > 1) {
      throw new Error('Too many games matched');
    }
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
      const total = Number(r.total);
      const correct = Number(r.correct);
      return {
        userId: r.userId,
        displayName: r.displayName,
        total,
        correct,
        incorrect: Number(r.incorrect),
        pending: Number(r.pending),
        percentage: total === 0 ? null : correct / total,
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
