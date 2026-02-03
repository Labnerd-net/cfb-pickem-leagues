interface NcaaScheduleToday {
  date: string;
  week: number;
  season: number;
}

interface NcaaScheduleGames {
  count: number;
  contestDate: string;
}

export interface NcaaScheduleOutput {
  data: {
    schedules: {
      games: NcaaScheduleGames[];
      today: NcaaScheduleToday;
    }
  }
}

interface NcaaConference {
  conferenceName: string;
  conferenceSeo: string;
}

interface NcaaScoreboardHomeAway {
  score: string;
  names: {
    char6: string;
    short: string;
    seo: string;
    full: string;
  };
  winner: boolean;
  seed: string;
  description: string;
  rank: string;
  conferences: NcaaConference[];
}

interface NcaaScoreboardGame {
  game: {
    gameID: string;
    away: NcaaScoreboardHomeAway;
    home: NcaaScoreboardHomeAway;
    finalMessage: string;
    bracketRound: string;
    title: string;
    contestName: string;
    url: string;
    network: string;
    liveVideoEnabled: boolean;
    startTime: string;
    startTimeEpoch: string;
    bracketId: string;
    gameState: string;
    startDate: string;
    currentPeriod: string;
    videoState: string;
    bracketRegion: string;
    contestClock: string;
  }
}

export interface NcaaScoreboardOutput {
  inputMD5Sum: string;
  instanceId: string;
  updated_at: string;
  games: NcaaScoreboardGame[];
}