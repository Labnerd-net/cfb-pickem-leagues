import { eq } from 'drizzle-orm';
import { users, games } from './schema/users.js';
import { db } from './index.js';
import * as dbAdminFunctions from './dbAdminFunctions.js';
import type { UserDbData, UserGamePicks } from '@shared/types/cfb-pickem-api.js';

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
    const id = Number(userId);
    return await db.select().from(users).where(eq(users.userId, id));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Add user
// ------------------------------------------------------------------
export async function addUser(email: string, passwordHash: string) {
  console.log(`Inside addUser dbUserFunction: adding ${email}`);
  try {
    return await db
      .insert(users)
      .values({
        email,
        passwordHash: passwordHash,
      })
      .returning({ id: users.userId });
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
    const id = Number(userId);
    return await db.delete(users).where(eq(users.userId, id));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Add Game Picks to user
// ------------------------------------------------------------------
export async function addPickedGame(pick: UserGamePicks): Promise<void> {
  console.log(`Inside addPickedGames dbUserFunction: game = ${pick.game}`);
  try {
    const gameInfo = await dbAdminFunctions.returnGame(pick.game);
    if (!gameInfo || gameInfo.length === 0) {
      throw new Error("Game Doesn't Exist");
    }
    if (gameInfo.length > 1) {
      throw new Error('Too many games matched');
    }
    await db.insert(games).values({
      gameId: pick.game,
      userId: 2,
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
