import { eq, and, inArray, notInArray } from 'drizzle-orm';
import { adminWeeks, adminGames } from './schema/admin.js';
import { db } from './index.js';
import logger from '../utils/logger.js';
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
  logger.debug({ week }, 'returnWeek');
  try {
    return await db.select().from(adminWeeks).where(eq(adminWeeks.weekNumber, week));
  } catch (e) {
    logger.error({ err: e }, 'returnWeek failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return weeks by year
// ------------------------------------------------------------------
export async function returnWeeksByYear(year: number): Promise<AdminWeekData[]> {
  logger.debug({ year }, 'returnWeeksByYear');
  try {
    return await db.select().from(adminWeeks).where(eq(adminWeeks.year, year));
  } catch (e) {
    logger.error({ err: e }, 'returnWeeksByYear failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return week by WeekIdentifier
// ------------------------------------------------------------------
export async function returnWeekByQuery(identifier: WeekIdentifier): Promise<AdminWeekData[]> {
  logger.debug({ year: identifier.year, week: identifier.week }, 'returnWeekByQuery');
  try {
    return await db
      .select()
      .from(adminWeeks)
      .where(and(eq(adminWeeks.year, identifier.year), eq(adminWeeks.weekNumber, identifier.week)));
  } catch (e) {
    logger.error({ err: e }, 'returnWeekByQuery failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return games for a given week
// ------------------------------------------------------------------
export async function returnGamesForWeek(identifier: WeekIdentifier): Promise<AdminDbGameData[]> {
  logger.debug({ year: identifier.year, week: identifier.week }, 'returnGamesForWeek');
  try {
    return await db
      .select()
      .from(adminGames)
      .where(and(eq(adminGames.year, identifier.year), eq(adminGames.weekNumber, identifier.week)));
  } catch (e) {
    logger.error({ err: e }, 'returnGamesForWeek failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Add a week
// ------------------------------------------------------------------
export async function addWeek(week: AdminWeekData): Promise<void> {
  logger.debug({ year: week.year, weekNumber: week.weekNumber }, 'addWeek');
  try {
    await db.insert(adminWeeks).values({
      weekNumber: week.weekNumber,
      year: week.year,
      seasonType: week.seasonType,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
    });
  } catch (e) {
    logger.error({ err: e }, 'addWeek failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Add single game to a week
// ------------------------------------------------------------------
export async function addGameToWeek(game: AdminGameData): Promise<void> {
  logger.debug({ year: game.year, week: game.weekNumber }, 'addGameToWeek');
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
    logger.error({ err: e }, 'addGameToWeek failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return game
// ------------------------------------------------------------------
export async function returnGame(game: number): Promise<AdminDbGameData[]> {
  logger.debug({ game }, 'returnGame');
  try {
    return await db.select().from(adminGames).where(eq(adminGames.gameId, game));
  } catch (e) {
    logger.error({ err: e }, 'returnGame failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Invert picked game
// ------------------------------------------------------------------
export async function invertPickedGame(game: number): Promise<void> {
  logger.debug({ game }, 'invertPickedGame');
  const newPicked = !adminGames.picked;
  try {
    await db
      .update(adminGames)
      .set({ picked: newPicked })
      .where(eq(adminGames.gameId, game));
  } catch (e) {
    logger.error({ err: e }, 'invertPickedGame failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Set all picked games from number array
// ------------------------------------------------------------------
export async function setPickedGame(games: number[]): Promise<void> {
  logger.debug({ count: games.length }, 'setPickedGame');
  try {
    await db.update(adminGames).set({ picked: true }).where(inArray(adminGames.gameId, games));
    await db.update(adminGames).set({ picked: false }).where(notInArray(adminGames.gameId, games));
  } catch (e) {
    logger.error({ err: e }, 'setPickedGame failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return all picked games
// ------------------------------------------------------------------
export async function returnPickedGames(identifier: WeekIdentifier): Promise<AdminDbGameData[]> {
  logger.debug({ year: identifier.year, week: identifier.week }, 'returnPickedGames');
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
    logger.error({ err: e }, 'returnPickedGames failed');
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
  logger.debug({ year, week }, 'getSeasonTypeForWeek');
  try {
    const weekData = await db
      .select({ seasonType: adminWeeks.seasonType })
      .from(adminWeeks)
      .where(and(eq(adminWeeks.year, year), eq(adminWeeks.weekNumber, week)))
      .limit(1);

    return weekData.length > 0 ? weekData[0].seasonType : null;
  } catch (e) {
    logger.error({ err: e }, 'getSeasonTypeForWeek failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Convert WeekIdentifier to WeekQuery by looking up seasonType
// ------------------------------------------------------------------
export async function enrichWeekIdentifier(
  identifier: WeekIdentifier
): Promise<WeekQuery> {
  logger.debug({ year: identifier.year, week: identifier.week }, 'enrichWeekIdentifier');
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
