import { eq, and, inArray, notInArray, lte, gte, max } from 'drizzle-orm';
import { adminWeeks, adminGames, scoreCorrections } from './schema/admin.js';
import { games as userGames } from './schema/users.js';
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
  PickedGamesRequest,
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
      .where(and(eq(adminGames.year, identifier.year), eq(adminGames.weekNumber, identifier.week)))
      .orderBy(adminGames.startTime);
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
// Upsert single game for a week (safe to re-import; preserves picked & gameId)
// ------------------------------------------------------------------
export async function upsertGameForWeek(game: AdminGameData): Promise<void> {
  logger.debug({ year: game.year, week: game.weekNumber }, 'upsertGameForWeek');
  try {
    let winningTeam: Team = 'pending';
    if (game.completed && game.homePoints !== null && game.awayPoints !== null) {
      if (game.homePoints > game.awayPoints) {
        winningTeam = 'home_team';
      } else if (game.awayPoints > game.homePoints) {
        winningTeam = 'away_team';
      }
    }
    await db
      .insert(adminGames)
      .values({
        cfbdGameId: game.cfbdGameId,
        picked: false,
        weekNumber: game.weekNumber,
        year: game.year,
        seasonType: game.seasonType,
        completed: game.completed,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homePoints: game.completed ? game.homePoints : null,
        awayPoints: game.completed ? game.awayPoints : null,
        winningTeam,
        startTime: game.startTime,
        spread: game.spread,
      })
      .onConflictDoUpdate({
        target: [adminGames.year, adminGames.weekNumber, adminGames.homeTeam, adminGames.awayTeam],
        set: {
          seasonType: game.seasonType,
          completed: game.completed,
          homePoints: game.completed ? game.homePoints : null,
          awayPoints: game.completed ? game.awayPoints : null,
          winningTeam,
          startTime: game.startTime,
          spread: game.spread,
        },
      });
  } catch (e) {
    logger.error({ err: e }, 'upsertGameForWeek failed');
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
// Return multiple games by ID array (bulk fetch)
// ------------------------------------------------------------------
export async function returnGamesBulk(gameIds: number[]): Promise<AdminDbGameData[]> {
  logger.debug({ count: gameIds.length }, 'returnGamesBulk');
  if (gameIds.length === 0) return [];
  try {
    return await db.select().from(adminGames).where(inArray(adminGames.gameId, gameIds));
  } catch (e) {
    logger.error({ err: e }, 'returnGamesBulk failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Set all picked games from number array
// ------------------------------------------------------------------
export async function setPickedGames(pickedGames: PickedGamesRequest): Promise<void> {
  logger.debug({ count: pickedGames.games.length }, 'setPickedGame');
  try {
    await db.transaction(async tx => {
      await tx
        .update(adminGames)
        .set({ picked: true })
        .where(
          and(
            inArray(adminGames.gameId, pickedGames.games),
            eq(adminGames.weekNumber, pickedGames.week),
            eq(adminGames.year, pickedGames.year)
          )
        );
      await tx
        .update(adminGames)
        .set({ picked: false })
        .where(
          and(
            notInArray(adminGames.gameId, pickedGames.games),
            eq(adminGames.weekNumber, pickedGames.week),
            eq(adminGames.year, pickedGames.year)
          )
        );
    });
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
export async function getSeasonTypeForWeek(year: number, week: number): Promise<SeasonType | null> {
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
// Return the current week based on today's date
// ------------------------------------------------------------------
export async function returnCurrentWeek(today: Date): Promise<AdminWeekData | null> {
  const dateStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
  logger.debug({ today: dateStr }, 'returnCurrentWeek');
  try {
    const rows = await db
      .select()
      .from(adminWeeks)
      .where(and(lte(adminWeeks.weekStart, dateStr), gte(adminWeeks.weekEnd, dateStr)))
      .limit(1);
    return rows.length > 0 ? rows[0] : null;
  } catch (e) {
    logger.error({ err: e }, 'returnCurrentWeek failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Mark a game as complete with final scores
// ------------------------------------------------------------------
export async function markGameComplete(
  gameId: number,
  homePoints: number,
  awayPoints: number
): Promise<AdminDbGameData | null> {
  logger.debug({ gameId, homePoints, awayPoints }, 'markGameComplete');
  try {
    let winningTeam: Team = 'pending';
    if (homePoints > awayPoints) {
      winningTeam = 'home_team';
    } else if (awayPoints > homePoints) {
      winningTeam = 'away_team';
    }
    const updated = await db
      .update(adminGames)
      .set({ completed: true, homePoints, awayPoints, winningTeam })
      .where(eq(adminGames.gameId, gameId))
      .returning();
    return updated.length > 0 ? updated[0] : null;
  } catch (e) {
    logger.error({ err: e }, 'markGameComplete failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Correct a game's final score and record the change in the audit log
// ------------------------------------------------------------------
export async function correctGameScore(
  gameId: number,
  homePoints: number,
  awayPoints: number,
  correctedBy: number
): Promise<AdminDbGameData | null> {
  logger.debug({ gameId, homePoints, awayPoints, correctedBy }, 'correctGameScore');
  try {
    return await db.transaction(async tx => {
      const currentRows = await tx
        .select()
        .from(adminGames)
        .where(eq(adminGames.gameId, gameId));
      if (currentRows.length === 0) return null;
      const current = currentRows[0];

      let winningTeam: Team = 'pending';
      if (homePoints > awayPoints) {
        winningTeam = 'home_team';
      } else if (awayPoints > homePoints) {
        winningTeam = 'away_team';
      }

      const updated = await tx
        .update(adminGames)
        .set({ completed: true, homePoints, awayPoints, winningTeam })
        .where(eq(adminGames.gameId, gameId))
        .returning();

      await tx.insert(scoreCorrections).values({
        gameId,
        correctedBy,
        oldHomePoints: current.homePoints,
        oldAwayPoints: current.awayPoints,
        newHomePoints: homePoints,
        newAwayPoints: awayPoints,
      });

      return updated.length > 0 ? updated[0] : null;
    });
  } catch (e) {
    logger.error({ err: e }, 'correctGameScore failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Get max regular season week number for a year.
// Used to translate stored postseason weekNumbers back to CFBD week numbers.
// ------------------------------------------------------------------
export async function getMaxRegularWeek(year: number): Promise<number> {
  const rows = await db
    .select({ maxWeek: max(adminWeeks.weekNumber) })
    .from(adminWeeks)
    .where(and(eq(adminWeeks.year, year), eq(adminWeeks.seasonType, 'regular')));
  return rows[0]?.maxWeek ?? 0;
}

// ------------------------------------------------------------------
// Check if any user picks exist for any game in a given year
// ------------------------------------------------------------------
export async function hasPicksForYear(year: number): Promise<boolean> {
  logger.debug({ year }, 'hasPicksForYear');
  try {
    const rows = await db
      .select({ gameId: userGames.gameId })
      .from(userGames)
      .innerJoin(adminGames, eq(userGames.gameId, adminGames.gameId))
      .where(eq(adminGames.year, year))
      .limit(1);
    return rows.length > 0;
  } catch (e) {
    logger.error({ err: e }, 'hasPicksForYear failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Delete all games for a year (must run before deleteWeeksForYear)
// ------------------------------------------------------------------
export async function deleteGamesForYear(year: number): Promise<void> {
  logger.debug({ year }, 'deleteGamesForYear');
  try {
    await db.delete(adminGames).where(eq(adminGames.year, year));
  } catch (e) {
    logger.error({ err: e }, 'deleteGamesForYear failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Delete all weeks for a year
// ------------------------------------------------------------------
export async function deleteWeeksForYear(year: number): Promise<void> {
  logger.debug({ year }, 'deleteWeeksForYear');
  try {
    await db.delete(adminWeeks).where(eq(adminWeeks.year, year));
  } catch (e) {
    logger.error({ err: e }, 'deleteWeeksForYear failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Convert WeekIdentifier to WeekQuery by looking up seasonType.
// The returned week is the DB-stored weekNumber (not the CFBD week).
// For postseason API calls, translate via getMaxRegularWeek().
// ------------------------------------------------------------------
export async function enrichWeekIdentifier(identifier: WeekIdentifier): Promise<WeekQuery> {
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
