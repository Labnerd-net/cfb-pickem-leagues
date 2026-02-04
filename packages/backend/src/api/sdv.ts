import sdv from 'sportsdataverse';

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
  console.log('sdv.cfb.getPlayByPlay(401256194):');
  console.log(JSON.stringify(playByPlay));

  // Get PickCenter betting data
  const picks = await sdv.cfb.getPicks(401256194);
  console.log('sdv.cfb.getPicks(401256194):');
  console.log(JSON.stringify(picks));

  // Get CFB rankings for a specific week
  const rankings = await sdv.cfb.getRankings({ year: 2020, week: 4 });
  console.log('sdv.cfb.getRankings({ year: 2020, week: 4 }):');
  console.log(JSON.stringify(rankings));

  // Get conference standings
  const standings = await sdv.cfb.getStandings({ year: 2020, group: 80 });
  console.log('sdv.cfb.getStandings({ year: 2020, group: 80 }):');
  console.log(JSON.stringify(standings));

  // Get list of conferences
  const conferences = await sdv.cfb.getConferences({ year: 2021, group: 80 });
  console.log('sdv.cfb.getConferences({ year: 2021, group: 80 }):');
  console.log(JSON.stringify(conferences));

  // Get team roster
  const roster = await sdv.cfb.getTeamPlayers(52);
  console.log('sdv.cfb.getTeamPlayers(52):');
  console.log(JSON.stringify(roster));
}
