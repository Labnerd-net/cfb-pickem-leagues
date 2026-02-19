import { eq, and } from 'drizzle-orm';
import { users, games } from './schema/users.js';
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
export async function returnUserById(userId: string): Promise<UserDbData[]> {
  logger.debug({ userId }, 'returnUserById');
  try {
    const userIdNumber = Number(userId);
    return await db.select().from(users).where(eq(users.userId, userIdNumber));
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
        id: users.userId,
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
export async function deleteUserById(userId: string) {
  logger.debug({ userId }, 'deleteUserById');
  try {
    const userIdNumber = Number(userId);
    return await db.delete(users).where(eq(users.userId, userIdNumber));
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
        cfbdGameId: gameInfo[0].cfbdGameId,
        ncaaGameId: gameInfo[0].ncaaGameId,
        weekNumber: gameInfo[0].weekNumber,
        year: gameInfo[0].year,
        seasonType: gameInfo[0].seasonType,
        completed: gameInfo[0].completed,
        homeTeam: gameInfo[0].homeTeam,
        awayTeam: gameInfo[0].awayTeam,
        homePoints: gameInfo[0].completed ? gameInfo[0].homePoints : -1,
        awayPoints: gameInfo[0].completed ? gameInfo[0].awayPoints : -1,
        winningTeam: gameInfo[0].winningTeam,
        teamChosen: pick.pick,
      })
      .onConflictDoUpdate({
        target: [games.userId, games.gameId],
        set: {
          teamChosen: pick.pick,
          completed: gameInfo[0].completed,
          homePoints: gameInfo[0].completed ? gameInfo[0].homePoints : -1,
          awayPoints: gameInfo[0].completed ? gameInfo[0].awayPoints : -1,
          winningTeam: gameInfo[0].winningTeam,
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
      .select()
      .from(games)
      .where(
        and(
          eq(games.year, identifier.year),
          eq(games.weekNumber, identifier.week),
          eq(games.userId, userIdNumber)
        )
      );
  } catch (e) {
    logger.error({ err: e }, 'returnUserGames failed');
    throw e;
  }
}
