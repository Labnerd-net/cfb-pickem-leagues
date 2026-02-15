import { eq, and, inArray, notInArray } from 'drizzle-orm';
import { adminWeeks, adminGames } from './schema/admin.js';
import { db } from './index.js';
import type {
  AdminDbGameData,
  AdminGameData,
  AdminWeekData,
  Team,
  WeekQuery,
  WeekIdentifier,
  SeasonType,
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
// Return weeks by year
// ------------------------------------------------------------------
export async function returnWeeksByYear(year: number): Promise<AdminWeekData[]> {
  console.log(`Inside returnWeeksByYear dbAdminFunction: year=${year}`);
  try {
    return await db.select().from(adminWeeks).where(eq(adminWeeks.year, year));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return week by WeekIdentifier
// ------------------------------------------------------------------
export async function returnWeekByQuery(identifier: WeekIdentifier): Promise<AdminWeekData[]> {
  console.log(`Inside returnWeekByQuery dbAdminFunction: year=${identifier.year}, week=${identifier.week}`);
  try {
    return await db
      .select()
      .from(adminWeeks)
      .where(and(eq(adminWeeks.year, identifier.year), eq(adminWeeks.weekNumber, identifier.week)));
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Return games for a given week
// ------------------------------------------------------------------
export async function returnGamesForWeek(identifier: WeekIdentifier): Promise<AdminDbGameData[]> {
  console.log(`Inside returnGamesForWeek dbAdminFunction: year=${identifier.year}, week=${identifier.week}`);
  try {
    return await db
      .select()
      .from(adminGames)
      .where(and(eq(adminGames.year, identifier.year), eq(adminGames.weekNumber, identifier.week)));
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
export async function returnPickedGames(identifier: WeekIdentifier): Promise<AdminDbGameData[]> {
  console.log(`Inside returnPickedGames dbAdminFunction: year=${identifier.year}, week=${identifier.week}`);
  try {
    return await db
      .select()
      .from(adminGames)
      .where(
        and(
          eq(adminGames.year, identifier.year),
          eq(adminGames.weekNumber, identifier.week),
          eq(adminGames.picked, true)
        )
      );
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Get seasonType for a week
// ------------------------------------------------------------------
export async function getSeasonTypeForWeek(
  year: number,
  week: number
): Promise<SeasonType | null> {
  console.log(`Inside getSeasonTypeForWeek dbAdminFunction: year=${year}, week=${week}`);
  try {
    const weekData = await db
      .select({ seasonType: adminWeeks.seasonType })
      .from(adminWeeks)
      .where(and(eq(adminWeeks.year, year), eq(adminWeeks.weekNumber, week)))
      .limit(1);

    return weekData.length > 0 ? weekData[0].seasonType : null;
  } catch (e) {
    console.log(e);
    throw e;
  }
}

// ------------------------------------------------------------------
// Convert WeekIdentifier to WeekQuery by looking up seasonType
// ------------------------------------------------------------------
export async function enrichWeekIdentifier(
  identifier: WeekIdentifier
): Promise<WeekQuery> {
  console.log(`Inside enrichWeekIdentifier dbAdminFunction: year=${identifier.year}, week=${identifier.week}`);
  const seasonType = await getSeasonTypeForWeek(identifier.year, identifier.week);

  if (!seasonType) {
    throw new Error(
      `Week ${identifier.week} of year ${identifier.year} not found in database. ` +
      `Please ensure weeks are loaded before fetching games.`
    );
  }

  return {
    year: identifier.year,
    week: identifier.week,
    seasonType,
  };
}
