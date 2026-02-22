import { eq, and } from 'drizzle-orm';
import { users, games } from './schema/users.js';
import { adminGames } from './schema/admin.js';
import { db } from './index.js';
import * as dbAdminFunctions from './dbAdminFunctions.js';
import logger from '../utils/logger.js';
import type {
  UserData,
  UserDbData,
  UserDbGameData,
  UserGamePicks,
  WeekIdentifier,
} from '@shared/types/cfb-pickem-api.js';

// ------------------------------------------------------------------
// Return all users
// ------------------------------------------------------------------
export async function returnUsers(): Promise<UserDbData[]> {
  logger.debug('returnUsers');
  try {
    return await db.select().from(users);
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
// Delete user by Id
// ------------------------------------------------------------------
export async function deleteUserById(userId: number) {
  logger.debug({ userId }, 'deleteUserById');
  try {
    return await db.delete(users).where(eq(users.userId, userId));
  } catch (e) {
    logger.error({ err: e }, 'deleteUserById failed');
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
