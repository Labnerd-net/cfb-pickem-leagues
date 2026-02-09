import { eq, and } from 'drizzle-orm';
import { users, games } from './schema/users.js';
import { db } from './index.js';
import { returnID } from '../api/index.js';
import * as dbAdminFunctions from './dbAdminFunctions.js';
import type {
  UserData,
  UserDbData,
  UserDbGameData,
  UserGamePicks,
  WeekIdData,
} from '@shared/types/cfb-pickem-api.js';

// ------------------------------------------------------------------
// Return all users
// ------------------------------------------------------------------
export async function returnUsers(): Promise<UserDbData[]> {
  console.log(`Inside returnUsers dbUserFunction`);
  try {
    return await db.select().from(users);
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return user by Email
// ------------------------------------------------------------------
export async function returnUserByEmail(email: string): Promise<UserDbData[]> {
  console.log(`Inside returnUserByEmail dbUserFunction: email=${email}`);
  try {
    return await db.select().from(users).where(eq(users.email, email));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return user by Id
// ------------------------------------------------------------------
export async function returnUserById(userId: string): Promise<UserDbData[]> {
  console.log(`Inside returnUserById dbUserFunction: id=${userId}`);
  try {
    const userIdNumber = Number(userId);
    return await db.select().from(users).where(eq(users.userId, userIdNumber));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Add user
// ------------------------------------------------------------------
export async function addUser(user: UserData) {
  console.log(`Inside addUser dbUserFunction: adding ${user.email}`);
  try {
    return await db
      .insert(users)
      .values({
        email: user.email,
        passwordHash: user.passwordHash,
        roles: user.roles,
      })
      .returning({ id: users.userId, email: users.email, roles: users.roles });
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Delete user by Id
// ------------------------------------------------------------------
export async function deleteUserById(userId: string) {
  console.log(`Inside deleteUserById dbUserFunction: deleting id=${userId}`);
  try {
    const userIdNumber = Number(userId);
    return await db.delete(users).where(eq(users.userId, userIdNumber));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Add Game Picks to user
// ------------------------------------------------------------------
export async function addPickedGame(pick: UserGamePicks, userId: string): Promise<void> {
  console.log(`Inside addPickedGames dbUserFunction: game = ${pick.game}`);
  try {
    const userIdNumber = Number(userId);
    const gameInfo = await dbAdminFunctions.returnGame(pick.game);
    if (!gameInfo || gameInfo.length === 0) {
      throw new Error("Game Doesn't Exist");
    }
    if (gameInfo.length > 1) {
      throw new Error('Too many games matched');
    }
    const userGameId = uniqueGameId(userIdNumber, pick.game);
    await db.insert(games).values({
      userGameId: userGameId,
      cfbdGameId: gameInfo[0].cfbdGameId,
      ncaaGameId: gameInfo[0].ncaaGameId,
      userId: userIdNumber,
      weekId: gameInfo[0].weekId,
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
    });
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return User Games
// ------------------------------------------------------------------
export async function returnUserGames(
  idData: WeekIdData,
  userId: string
): Promise<UserDbGameData[]> {
  const id = returnID(idData);
  const userIdNumber = Number(userId);
  console.log(`Inside returnUserGames dbUserFunction: week_id=${id}`);
  try {
    return await db
      .select()
      .from(games)
      .where(and(eq(games.weekId, id), eq(games.userId, userIdNumber)));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

function uniqueGameId(userId: number, gameId: number) {
  return gameId * 1000 + userId;
}
