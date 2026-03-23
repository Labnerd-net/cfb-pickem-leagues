import type {
  AdminGameData,
  AdminWeekData,
  Classification,
  Team,
  WeekQuery,
} from '@shared/types/cfb-pickem-api.js';
import { getCfbdGameData, getCfbdWeekData, getCfbdLinesData } from './cfbd.js';

// ------------------------------------------------------------------
// Converts schedules from CFBD to database type
// ------------------------------------------------------------------
export async function getWeekData(year: number): Promise<AdminWeekData[]> {
  const weekData: AdminWeekData[] = [];
  const cfbdWeekData = await getCfbdWeekData(year);

  const regularWeeks = cfbdWeekData?.filter(w => w.seasonType === 'regular') ?? [];
  const regularWeekCount = Math.max(...regularWeeks.map(w => w.week), 0);

  cfbdWeekData?.forEach(week => {
    const data = {} as AdminWeekData;

    if (week.seasonType === 'postseason') {
      data.weekNumber = regularWeekCount + week.week;
    } else {
      data.weekNumber = week.week;
    }

    data.year = week.season;
    data.seasonType = week.seasonType;
    data.weekStart = week.startDate;
    data.weekEnd = week.endDate;
    weekData.push(data);
  });

  return weekData;
}

// ------------------------------------------------------------------
// Converts games from CFBD to database type (fetches spread in parallel)
// ------------------------------------------------------------------
export async function getGameData(
  queryData: WeekQuery,
  classification: Classification = 'fbs',
  cfbdWeek?: number
): Promise<AdminGameData[]> {
  const gameData: AdminGameData[] = [];

  // For postseason, the DB week is offset by the regular season count.
  // cfbdWeek carries the original CFBD week number (1, 2, 3…) for the API call.
  const apiQuery = cfbdWeek !== undefined ? { ...queryData, week: cfbdWeek } : queryData;

  const [cfbdGamedata, cfbdLinesData] = await Promise.all([
    getCfbdGameData(apiQuery, classification),
    getCfbdLinesData(apiQuery),
  ]);

  // Build a lookup map: cfbdGameId -> spread (home team perspective)
  const spreadMap = new Map<number, number | null>();
  cfbdLinesData?.forEach(bettingGame => {
    const consensusLine = bettingGame.lines.find(l => l.provider === 'consensus');
    const line = consensusLine ?? bettingGame.lines[0] ?? null;
    spreadMap.set(bettingGame.id, line ? line.spread : null);
  });

  cfbdGamedata?.forEach(game => {
    let winningTeam: Team = 'pending';
    let homePoints: number | null = null;
    let awayPoints: number | null = null;
    if (game.completed && game.homePoints != null && game.awayPoints != null) {
      homePoints = game.homePoints;
      awayPoints = game.awayPoints;
      if (homePoints > awayPoints) winningTeam = 'home_team';
      if (awayPoints > homePoints) winningTeam = 'away_team';
    }
    const data = {} as AdminGameData;
    data.cfbdGameId = game.id;
    data.picked = false;
    data.weekNumber = queryData.week;
    data.year = queryData.year;
    data.seasonType = queryData.seasonType;
    data.completed = game.completed;
    data.homeTeam = game.homeTeam;
    data.awayTeam = game.awayTeam;
    data.homePoints = homePoints;
    data.awayPoints = awayPoints;
    data.winningTeam = winningTeam;
    data.startTime = game.startDate ? new Date(game.startDate) : null;
    data.spread = spreadMap.get(game.id) ?? null;
    gameData.push(data);
  });

  return gameData;
}
