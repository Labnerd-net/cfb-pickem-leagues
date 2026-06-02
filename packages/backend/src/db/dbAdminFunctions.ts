import { eq, and, inArray, lte, gte, gt, max, asc, sql } from 'drizzle-orm';
import { adminWeeks, adminGames, scoreCorrections } from './schema/admin.js';
import { games as userGames } from './schema/users.js';
import { leagueGames } from './schema/leagues.js';
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
// Upsert single game for a week (safe to re-import; preserves gameId on conflict)
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
// Return all games in a league's pool for a week
// ------------------------------------------------------------------
export async function getGamesForLeagueWeek(
  leagueId: number,
  year: number,
  week: number
): Promise<AdminDbGameData[]> {
  logger.debug({ leagueId, year, week }, 'getGamesForLeagueWeek');
  try {
    return await db
      .select({
        gameId: adminGames.gameId,
        cfbdGameId: adminGames.cfbdGameId,
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
        spread: adminGames.spread,
        createdAt: adminGames.createdAt,
      })
      .from(adminGames)
      .innerJoin(
        leagueGames,
        and(eq(leagueGames.gameId, adminGames.gameId), eq(leagueGames.leagueId, leagueId))
      )
      .where(and(eq(adminGames.year, year), eq(adminGames.weekNumber, week)));
  } catch (e) {
    logger.error({ err: e }, 'getGamesForLeagueWeek failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return all global games for a week annotated with inLeague status
// ------------------------------------------------------------------
export async function getGlobalGamesWithLeagueStatus(
  leagueId: number,
  year: number,
  week: number
): Promise<(AdminDbGameData & { inLeague: boolean })[]> {
  logger.debug({ leagueId, year, week }, 'getGlobalGamesWithLeagueStatus');
  try {
    const rows = await db
      .select({
        gameId: adminGames.gameId,
        cfbdGameId: adminGames.cfbdGameId,
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
        spread: adminGames.spread,
        createdAt: adminGames.createdAt,
        inLeague: sql<boolean>`(${leagueGames.gameId} IS NOT NULL)`,
      })
      .from(adminGames)
      .leftJoin(
        leagueGames,
        and(eq(leagueGames.gameId, adminGames.gameId), eq(leagueGames.leagueId, leagueId))
      )
      .where(and(eq(adminGames.year, year), eq(adminGames.weekNumber, week)));
    return rows.map(r => ({ ...r, inLeague: Boolean(r.inLeague) }));
  } catch (e) {
    logger.error({ err: e }, 'getGlobalGamesWithLeagueStatus failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Add a game to a league's pool
// ------------------------------------------------------------------
export async function addGameToLeague(leagueId: number, gameId: number): Promise<void> {
  logger.debug({ leagueId, gameId }, 'addGameToLeague');
  try {
    const game = await db
      .select({ gameId: adminGames.gameId })
      .from(adminGames)
      .where(eq(adminGames.gameId, gameId))
      .limit(1);
    if (game.length === 0) throw Object.assign(new Error('Game not found'), { status: 404 });

    const existing = await db
      .select()
      .from(leagueGames)
      .where(and(eq(leagueGames.leagueId, leagueId), eq(leagueGames.gameId, gameId)))
      .limit(1);
    if (existing.length > 0) throw Object.assign(new Error('Game already in league pool'), { status: 409 });

    await db.insert(leagueGames).values({ leagueId, gameId });
  } catch (e) {
    logger.error({ err: e }, 'addGameToLeague failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Remove a game from a league's pool (blocks if any picks exist)
// ------------------------------------------------------------------
export async function removeGameFromLeague(leagueId: number, gameId: number): Promise<void> {
  logger.debug({ leagueId, gameId }, 'removeGameFromLeague');
  try {
    const picks = await db
      .select({ userId: userGames.userId })
      .from(userGames)
      .where(and(eq(userGames.gameId, gameId), eq(userGames.leagueId, leagueId)))
      .limit(1);
    if (picks.length > 0)
      throw Object.assign(new Error('Cannot remove a game that has picks'), { status: 409 });

    await db
      .delete(leagueGames)
      .where(and(eq(leagueGames.leagueId, leagueId), eq(leagueGames.gameId, gameId)));
  } catch (e) {
    logger.error({ err: e }, 'removeGameFromLeague failed');
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
// Correct a game's final score and record the change in the audit log
// ------------------------------------------------------------------
export async function getGameById(gameId: number): Promise<AdminDbGameData | null> {
  const rows = await db.select().from(adminGames).where(eq(adminGames.gameId, gameId));
  return rows[0] ?? null;
}

export async function correctGameScore(
  gameId: number,
  homePoints: number,
  awayPoints: number,
  winningTeam: Team,
  oldHomePoints: number | null,
  oldAwayPoints: number | null,
  correctedBy: number
): Promise<AdminDbGameData | null> {
  logger.debug({ gameId, homePoints, awayPoints, correctedBy }, 'correctGameScore');
  try {
    const updated = await db
      .update(adminGames)
      .set({ completed: true, homePoints, awayPoints, winningTeam })
      .where(eq(adminGames.gameId, gameId))
      .returning();

    if (updated.length === 0) return null;

    await db.insert(scoreCorrections).values({
      gameId,
      correctedBy,
      oldHomePoints,
      oldAwayPoints,
      newHomePoints: homePoints,
      newAwayPoints: awayPoints,
    });

    return updated[0];
  } catch (e) {
    logger.error({ err: e }, 'correctGameScore failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return cfbdGameId values for games that have been manually corrected.
// Used by sync-results to skip corrected games so corrections aren't overwritten.
// ------------------------------------------------------------------
export async function getCorrectedCfbdGameIds(year: number, weekNumber: number): Promise<Set<number>> {
  logger.debug({ year, weekNumber }, 'getCorrectedCfbdGameIds');
  try {
    const rows = await db
      .selectDistinct({ cfbdGameId: adminGames.cfbdGameId })
      .from(scoreCorrections)
      .innerJoin(adminGames, eq(scoreCorrections.gameId, adminGames.gameId))
      .where(and(eq(adminGames.year, year), eq(adminGames.weekNumber, weekNumber)));
    return new Set(rows.map(r => r.cfbdGameId).filter((id): id is number => id !== null));
  } catch (e) {
    logger.error({ err: e }, 'getCorrectedCfbdGameIds failed');
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

// ------------------------------------------------------------------
// Resolve the week context for notification logging.
// Returns the active week if one exists, otherwise the next upcoming
// season year with weekNumber=0 (pre-season), or current calendar year
// with weekNumber=0 if no weeks exist in the DB at all.
// ------------------------------------------------------------------
export async function resolveWeekContext(now: Date): Promise<{ year: number; weekNumber: number }> {
  const current = await returnCurrentWeek(now);
  if (current) {
    return { year: current.year, weekNumber: current.weekNumber };
  }
  const dateStr = now.toISOString().slice(0, 10);
  // Check for an upcoming week — if one exists we're in a mid-season gap, not truly off-season
  const upcoming = await db
    .select({ year: adminWeeks.year })
    .from(adminWeeks)
    .where(gt(adminWeeks.weekStart, dateStr))
    .orderBy(asc(adminWeeks.weekStart))
    .limit(1);
  if (upcoming.length > 0) {
    return { year: upcoming[0].year, weekNumber: 0 };
  }
  // No upcoming weeks — season is over, use next year
  const rows = await db
    .select({ maxYear: max(adminWeeks.year) })
    .from(adminWeeks);
  const maxYear = rows[0]?.maxYear;
  if (maxYear != null) {
    return { year: maxYear + 1, weekNumber: 0 };
  }
  return { year: now.getFullYear(), weekNumber: 0 };
}
