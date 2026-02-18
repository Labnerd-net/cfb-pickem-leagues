import sdv from 'sportsdataverse';
import logger from '../utils/logger.js';

export async function getSdvCfbSchedule(
  year: number,
  month: number,
  day: number,
  group: number = 80
) {
  return await sdv.cfb.getSchedule({
    year: year,
    month: month,
    day: day,
    group: group, // 80 for FBS, 81 for FCS
  });
}

export async function getSdvCfbSummary(id: number) {
  return await sdv.cfb.getSummary(id);
}

export async function getSdvCfbBoxScore(id: number) {
  return await sdv.cfb.getBoxScore(id);
}

export async function getSdvCfbScoreboard(
  year: number,
  month: number,
  day: number,
  seasontype: number = 2,
  group: number = 80,
  limit: number = 300
) {
  return await sdv.cfb.getScoreboard({
    year: year,
    month: month,
    day: day,
    group: group,
    seasontype: seasontype, // 1=Pre-Season, 2=Regular, 3=Postseason, 4=Off-season
    limit: limit,
  });
}

export async function getSdvCfbTeamList(group: number = 80) {
  return await sdv.cfb.getTeamList({ group });
}

export async function getSdvCfbTeamInfo(id: number) {
  return await sdv.cfb.getTeamInfo(id);
}

export async function testAPI() {
  // Get play-by-play data for a specific game
  const playByPlay = await sdv.cfb.getPlayByPlay(401256194);
  logger.debug({ playByPlay }, 'sdv.cfb.getPlayByPlay(401256194)');

  // Get PickCenter betting data
  const picks = await sdv.cfb.getPicks(401256194);
  logger.debug({ picks }, 'sdv.cfb.getPicks(401256194)');

  // Get CFB rankings for a specific week
  const rankings = await sdv.cfb.getRankings({ year: 2020, week: 4 });
  logger.debug({ rankings }, 'sdv.cfb.getRankings({ year: 2020, week: 4 })');

  // Get conference standings
  const standings = await sdv.cfb.getStandings({ year: 2020, group: 80 });
  logger.debug({ standings }, 'sdv.cfb.getStandings({ year: 2020, group: 80 })');

  // Get list of conferences
  const conferences = await sdv.cfb.getConferences({ year: 2021, group: 80 });
  logger.debug({ conferences }, 'sdv.cfb.getConferences({ year: 2021, group: 80 })');

  // Get team roster
  const roster = await sdv.cfb.getTeamPlayers(52);
  logger.debug({ roster }, 'sdv.cfb.getTeamPlayers(52)');
}
