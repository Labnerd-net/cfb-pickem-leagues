import type {
  AdminGameData,
  AdminWeekData,
  Classification,
  Team,
  WeekQuery,
} from '@shared/types/cfb-pickem-api.js';
import { dataSource } from '../utils/envVars.js';
import { getCfbdGameData, getCfbdWeekData } from './cfbd.js';
import { getNcaaSchedule, getNcaaScoreboard } from './ncaa-api.js';

// ------------------------------------------------------------------
// Converts schedules from different data sources to database type
// ------------------------------------------------------------------
export async function getWeekData(year: number): Promise<AdminWeekData[]> {
  const weekData: AdminWeekData[] = [];
  if (dataSource === 'cfbd') {
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
  } else if (dataSource === 'ncaa') {
    const ncaaSchedule = await getNcaaSchedule(year);
    const ncaaYear = ncaaSchedule?.data?.schedules?.today?.season ?? year;
    const ncaaSeasonType = 'regular';
    const games = ncaaSchedule?.data?.schedules?.games ?? [];
    // Remove the last entry which is an aggregate summary of all postseason games
    const filteredGames = games.slice(0, -1);

    filteredGames.forEach((week, index: number) => {
      const dates = week.contestDate.split('-');
      const data = {} as AdminWeekData;
      data.weekNumber = index + 1;
      data.year = ncaaYear;
      data.seasonType = ncaaSeasonType;
      data.weekStart = dates[0];
      data.weekEnd = dates[1];
      weekData.push(data);
    });
  }
  return weekData;
}

// ------------------------------------------------------------------
// Converts games from different data sources to database type
// ------------------------------------------------------------------
export async function getGameData(
  queryData: WeekQuery,
  classification: Classification = 'fbs'
): Promise<AdminGameData[]> {
  const gameData: AdminGameData[] = [];
  if (dataSource === 'cfbd') {
    const cfbdGamedata = await getCfbdGameData(queryData, classification);
    cfbdGamedata?.forEach(game => {
      let winningTeam: Team = 'pending';
      let homePoints: number | null = null;
      let awayPoints: number | null = null;
      if (game.completed && game.homePoints && game.awayPoints) {
        homePoints = game.homePoints;
        awayPoints = game.awayPoints;
        if (homePoints > awayPoints) winningTeam = 'home_team';
        if (awayPoints > homePoints) winningTeam = 'away_team';
      }
      const data = {} as AdminGameData;
      data.cfbdGameId = game.id;
      data.ncaaGameId = null;
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
      gameData.push(data);
    });
  } else if (dataSource === 'ncaa') {
    // path = fbs/2025/01/all-conf
    const ncaaGameData = await getNcaaScoreboard(queryData, classification);
    ncaaGameData?.games?.forEach(game => {
      const completed = game.game.gameState === 'final' ? true : false;
      const winningTeam = game.game.away.winner
        ? 'away_team'
        : game.game.home.winner
          ? 'home_team'
          : 'pending';
      const homePoints = game.game.home.score === '' ? null : Number(game.game.home.score);
      const awayPoints = game.game.away.score === '' ? null : Number(game.game.away.score);
      const data = {} as AdminGameData;
      data.cfbdGameId = null;
      data.ncaaGameId = game.game.gameID;
      data.picked = false;
      data.weekNumber = queryData.week;
      data.year = queryData.year;
      data.seasonType = queryData.seasonType;
      data.completed = completed;
      data.homeTeam = game.game.home.names.short;
      data.awayTeam = game.game.away.names.short;
      data.homePoints = homePoints;
      data.awayPoints = awayPoints;
      data.winningTeam = winningTeam;
      data.startTime = game.game.startTimeEpoch
        ? new Date(Number(game.game.startTimeEpoch) * 1000)
        : null;
      gameData.push(data);
    });
  }
  return gameData;
}
