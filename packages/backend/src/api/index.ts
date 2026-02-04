import type { AdminGameData, AdminWeekData, Classification, Team, WeekIdData } from '@shared/types/cfb-pickem-api.js';
import { dataSource } from '../utils/envVars.js';
import { getCfbdGameData, getCfbdWeekData } from './cfbd.js';
import { getNcaaSchedule, getNcaaScoreboard } from './ncaa-api.js';
// import { getSdvWeekData, getSdvGameData } from './sdv.js';

// ------------------------------------------------------------------
// Converts schedules from different data sources to database type
// ------------------------------------------------------------------
export async function getWeekData(year: number): Promise<AdminWeekData[]> {
  const weekData: AdminWeekData[] = [];
  if (dataSource === 'cfbd') {
    const cfbdWeekData = await getCfbdWeekData(year);
    cfbdWeekData?.forEach(week => {
      const id = returnID({
        seasonType: week.seasonType,
        week: week.week,
        year: week.season,
      });
      const data = {} as AdminWeekData;
      data.weekId = id;
      data.weekNumber = week.week;
      data.year = week.season;
      data.seasonType = week.seasonType;
      data.weekStart = week.startDate;
      data.weekEnd = week.endDate;
      weekData.push(data);
    })
  } else if (dataSource === 'ncaa') {
    const ncaaSchedule = await getNcaaSchedule(year);
    const ncaaYear = (ncaaSchedule?.data?.schedules?.today?.season) ? ncaaSchedule.data?.schedules.today.season : year;
    const ncaaSeasonType = 'regular';
    ncaaSchedule?.data?.schedules?.games?.forEach((week, index: number) => {
      const id = returnID({
        seasonType: ncaaSeasonType,
        week: index+1,
        year: ncaaYear,
      });
      console.log(`adding weekId = ${id}`)
      const dates = week.contestDate.split("-");
      const data = {} as AdminWeekData;
      data.weekId = id;
      data.weekNumber = index+1;
      data.year = ncaaYear;
      data.seasonType = ncaaSeasonType;
      data.weekStart = dates[0];
      data.weekEnd = dates[1];
      weekData.push(data);
    })
  }
  return weekData;
}

// ------------------------------------------------------------------
// Converts games from different data sources to database type
// ------------------------------------------------------------------
export async function getGameData(idData: WeekIdData, classification: Classification = 'fbs'): Promise<AdminGameData[]> {
  const gameData: AdminGameData[] = [];
  const id = returnID(idData);
  if (dataSource === 'cfbd') {
    const cfbdGamedata = await getCfbdGameData(idData, classification);
    cfbdGamedata?.forEach(game => {
      let winningTeam: Team = 'pending';
      let homePoints = -1;
      let awayPoints = -1;
      if (game.completed && game.homePoints && game.awayPoints) {
        homePoints = game.homePoints;
        awayPoints = game.awayPoints;
        if (homePoints > awayPoints) winningTeam = 'home_team';
        if (awayPoints > homePoints) winningTeam = 'away_team';
      }
      const data = {} as AdminGameData;
      data.weekId = id;
      data.picked = false;
      data.weekNumber = idData.week;
      data.year = idData.year;
      data.seasonType = idData.seasonType;
      data.completed = game.completed;
      data.homeTeam = game.homeTeam;
      data.awayTeam = game.awayTeam;
      data.homePoints = homePoints
      data.awayPoints = awayPoints;
      data.winningTeam = winningTeam;
      gameData.push(data);
    })
  } else if (dataSource === 'ncaa') {
    // path = fbs/2025/01/all-conf
    const ncaaGameData = await getNcaaScoreboard(idData, classification);
    ncaaGameData?.games?.forEach(game => {
      const completed = (game.game.gameState === 'final') ? true : false;
      const winningTeam = (game.game.away.winner) ? 'away_team' : (game.game.home.winner) ? 'home_team' : 'pending';
      const homePoints = (game.game.home.score === '') ? -1 : Number(game.game.home.score);
      const awayPoints = (game.game.away.score === '') ? -1 : Number(game.game.away.score);
      const data = {} as AdminGameData;
      data.weekId = id;
      data.picked = false;
      data.weekNumber = idData.week;
      data.year = idData.year;
      data.seasonType = idData.seasonType;
      data.completed = completed;
      data.homeTeam = game.game.home.names.short;
      data.awayTeam = game.game.away.names.short;
      data.homePoints = homePoints
      data.awayPoints = awayPoints;
      data.winningTeam = winningTeam;
      gameData.push(data);
    })
  }
  return gameData;
}

// ------------------------------------------------------------------
// Returns a unique id based on year, week, and season type
// ------------------------------------------------------------------
export function returnID(idData: WeekIdData): number {
  console.log('idData:')
  console.log(idData);
  const { seasonType, year, week } = idData;
  let adjustment: number = 0;
  switch (seasonType) {
    case 'regular':
      adjustment = 0;
      break;
    case 'postseason':
      adjustment = 100;
      break;
    default:
      adjustment = 900;
  }
  const id = Number(year) * 1000 + adjustment + Number(week);
  console.log(`result = ${id}`)
  return id;
}
