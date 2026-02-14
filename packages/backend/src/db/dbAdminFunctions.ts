import { eq, and, inArray, notInArray } from 'drizzle-orm';
import { adminWeeks, adminGames } from './schema/admin.js';
import { db } from './index.js';
import type {
  AdminDbGameData,
  AdminGameData,
  AdminWeekData,
  Team,
  WeekQuery,
} from '@shared/types/cfb-pickem-api.js';

// ------------------------------------------------------------------
// Return week
// ------------------------------------------------------------------
export async function returnWeek(week: number): Promise<AdminWeekData[]> {
  console.log(`Inside returnWeek dbAdminFunction: week=${week}`);
  try {
    return await db.select().from(adminWeeks).where(eq(adminWeeks.weekNumber, week));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return week by WeekQuery
// ------------------------------------------------------------------
export async function returnWeekByQuery(query: WeekQuery): Promise<AdminWeekData[]> {
  console.log(`Inside returnWeekByQuery dbAdminFunction: year=${query.year}, week=${query.week}`);
  try {
    return await db
      .select()
      .from(adminWeeks)
      .where(and(eq(adminWeeks.year, query.year), eq(adminWeeks.weekNumber, query.week)));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return games for a given week
// ------------------------------------------------------------------
export async function returnGamesForWeek(query: WeekQuery): Promise<AdminDbGameData[]> {
  console.log(`Inside returnGamesForWeek dbAdminFunction: year=${query.year}, week=${query.week}`);
  try {
    return await db
      .select()
      .from(adminGames)
      .where(and(eq(adminGames.year, query.year), eq(adminGames.weekNumber, query.week)));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Add a week
// ------------------------------------------------------------------
export async function addWeek(week: AdminWeekData): Promise<void> {
  console.log(`Inside addWeek dbAdminFunction: year=${week.year}, weekNumber=${week.weekNumber}`);
  try {
    await db.insert(adminWeeks).values({
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
export async function addGameToWeek(game: AdminGameData): Promise<void> {
  console.log(`Inside addGameToWeek dbAdminFunction: year=${game.year}, week=${game.weekNumber}`);
  try {
    let winningTeam: Team = 'pending';
    if (game.completed && game.homePoints !== null && game.awayPoints !== null) {
      if (game.homePoints > game.awayPoints) {
        winningTeam = 'home_team';
      } else if (game.awayPoints > game.homePoints) {
        winningTeam = 'away_team';
      }
    }
    await db.insert(adminGames).values({
      cfbdGameId: game.cfbdGameId,
      ncaaGameId: game.ncaaGameId,
      picked: false,
      weekNumber: game.weekNumber,
      year: game.year,
      seasonType: game.seasonType,
      completed: game.completed,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homePoints: game.completed ? game.homePoints : -1,
      awayPoints: game.completed ? game.awayPoints : -1,
      winningTeam: winningTeam,
    });
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return game
// ------------------------------------------------------------------
export async function returnGame(game: number): Promise<AdminDbGameData[]> {
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
export async function invertPickedGame(game: number): Promise<void> {
  console.log(`Inside updatePickedGame dbAdminFunction: game=${game}`);
  const newPicked = !adminGames.picked;
  try {
    await db
      .update(adminGames)
      .set({ picked: newPicked })
      .where(eq(adminGames.gameId, game));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Set all picked games from number array
// ------------------------------------------------------------------
export async function setPickedGame(games: number[]): Promise<void> {
  console.log(`Inside updatePickedGame dbAdminFunction: games=${games}`);
  try {
    await db.update(adminGames).set({ picked: true }).where(inArray(adminGames.gameId, games));
    await db.update(adminGames).set({ picked: false }).where(notInArray(adminGames.gameId, games));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return all picked games
// ------------------------------------------------------------------
export async function returnPickedGames(query: WeekQuery): Promise<AdminDbGameData[]> {
  console.log(`Inside returnPickedGames dbAdminFunction: year=${query.year}, week=${query.week}`);
  try {
    return await db
      .select()
      .from(adminGames)
      .where(
        and(
          eq(adminGames.year, query.year),
          eq(adminGames.weekNumber, query.week),
          eq(adminGames.picked, true)
        )
      );
  } catch (e) {
    console.log(e);
    throw e;
  }
}
