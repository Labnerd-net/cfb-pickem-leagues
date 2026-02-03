import { eq, and, inArray, notInArray } from 'drizzle-orm';
import { adminWeeks, adminGames } from './schema/admin.js';
import { db } from './index.js';
import type { AdminGameData, AdminWeekData, Team, WeekIdData } from '../types/data.js';
import { returnID } from '../api/index.js';

// ------------------------------------------------------------------
// Return week
// ------------------------------------------------------------------
export async function returnWeek(week: number) {
  console.log(`Inside returnWeek dbAdminFunction: week=${week}`);
  try {
    return await db.select().from(adminWeeks).where(eq(adminWeeks.weekNumber, week));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return games for a given week
// ------------------------------------------------------------------
export async function returnGamesForWeek(idData: WeekIdData) {
  const id = returnID(idData);
  console.log(`Inside returnGamesForWeek dbAdminFunction: week_id = ${id}`);
  try {
    return await db.select().from(adminGames).where(eq(adminGames.weekId, id));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Add a week
// ------------------------------------------------------------------
export async function addWeek(week: AdminWeekData) {
  console.log(`Inside addWeek dbAdminFunction: week_id=${week.weekId}`);
  try {
    await db.insert(adminWeeks).values({
      weekId: week.weekId,
      weekNumber: week.weekNumber,
      year: week.year,
      seasonType: week.seasonType,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
    });
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Add single game to a week
// ------------------------------------------------------------------
export async function addGameToWeek(game: AdminGameData) {
  console.log(`Inside addGameToWeek dbAdminFunction: week_id=${game.weekId}`);
  try {
    let winning_team: Team = 'pending';
    if (game.completed && game.homePoints !== null && game.awayPoints !== null) {
      if (game.homePoints > game.awayPoints) {
        winning_team = 'home_team';
      } else if (game.awayPoints > game.homePoints) {
        winning_team = 'away_team';
      }
    }
    await db.insert(adminGames).values({
      weekId: game.weekId,
      picked: false,
      weekNumber: game.weekNumber,
      year: game.year,
      seasonType: game.seasonType,
      completed: game.completed,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homePoints: game.completed ? game.homePoints : -1,
      awayPoints: game.completed ? game.awayPoints : -1,
      winningTeam: winning_team,
    });
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return game
// ------------------------------------------------------------------
export async function returnGame(game: number) {
  console.log(`Inside returnGame dbAdminFunction: game=${game}`);
  try {
    return await db.select().from(adminGames).where(eq(adminGames.gameId, game));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Invert picked game
// ------------------------------------------------------------------
export async function invertPickedGame(game: number) {
  console.log(`Inside updatePickedGame dbAdminFunction: game=${game}`);
  try {
    await db
      .update(adminGames)
      .set({ picked: !adminGames.picked })
      .where(eq(adminGames.gameId, game));
  } catch (e) {
    console.log(e);
    throw e;
  }
}


// ------------------------------------------------------------------
// Set all picked games from number array
// ------------------------------------------------------------------
export async function setPickedGame(games: number[]) {
  console.log(`Inside updatePickedGame dbAdminFunction: games=${games}`);
  try {
    await db
      .update(adminGames)
      .set({ picked: true })
      .where(inArray(adminGames.gameId, games));
    await db
      .update(adminGames)
      .set({ picked: false })
      .where(notInArray(adminGames.gameId, games));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return all picked games
// ------------------------------------------------------------------
export async function returnPickedGames(idData: WeekIdData) {
  const id = returnID(idData);
  console.log(`Inside returnPickedGames dbAdminFunction: week_id=${id}`);
  try {
    return await db
      .select()
      .from(adminGames)
      .where(and(eq(adminGames.weekId, id), eq(adminGames.picked, true)));
  } catch (e) {
    console.log(e);
    throw e;
  }
}
