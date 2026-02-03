// types/sportsdataverse.d.ts
declare module 'sportsdataverse' {
  export const cfb: {
    getPlayByPlay(id: number): Promise<PlayByPlayData>;
    getBoxScore(id: number): Promise<BoxScoreData>;
    getSummary(id: number): Promise<GameSummary>;
    getPicks(id: number): Promise<PickCenterData>;
    getPlayerRankings(args: { year: number; page?: number; group?: "HighSchool" | "JuniorCollege" | "PrepSchool"; state?: string }): Promise<PlayerRankings>;
    getSchoolRankings(args: { year: number; page?: number }): Promise<SchoolRankings>;
    getSchoolCommits(args: { year: number; school: string }): Promise<SchoolCommits>;
    getRankings(args: { year: number; week: number }): Promise<CFBRankings>;
    getSchedule(args: { year: number; month: number; day: number; group: number; seasontype?: number }): Promise<ScheduleData[]>;
    getScoreboard(args: { year: number; month: number; day: number; group: number; seasontype?: number; limit?: number }): Promise<Game[]>;
    getConferences(args: { year: number; group: number }): Promise<ConferenceData[]>;
    getStandings(args: { year: number; group: number }): Promise<TeamStandings[]>;
    getTeamList(args: { group: number }): Promise<TeamInfo[]>;
    getTeamInfo(id: number): Promise<TeamDetails>;
    getTeamPlayers(id: number): Promise<TeamRoster>;
  };
}

interface Team {
  id: string;
  uid: string;
  name: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  location: string;
  color: string;
  alternateColor: string;
  logo: string;
}

interface Game {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;
  season: { year: number; type: number };
  week: { number: number };
  status: {
    clock: number;
    displayClock: string;
    period: number;
    type: { id: string; name: string; state: string };
  };
  competitors: [
    {
      id: string;
      team: Team;
      score: string;
      linescores: Array<{ value: number }>;
      winner: boolean;
    },
    {
      id: string;
      team: Team;
      score: string;
      linescores: Array<{ value: number }>;
      winner: boolean;
    }
  ];
  venue: { id: string; name: string; fullName: string };
}

interface PlayByPlayData {
  id: string;
  gameInfo: { game: Game };
  plays: Array<{
    id: string;
    type: { text: string };
    text: string;
    awayScore: number;
    homeScore: number;
    period: { number: number };
    clock: { displayValue: string };
    team: Team;
    start: {
      yardLine: number;
      down: number;
      distance: number;
      possession: string;
    };
  }>;
}

interface BoxScoreData {
  id: string;
  teams: [
    {
      team: Team;
      statistics: Array<{ name: string; label: string; displayValue: string }>;
      players: Array<{
        athlete: { id: string; displayName: string; position: string };
        statistics: Array<{ name: string; description: string; displayValue: string }>;
      }>;
    },
    {
      team: Team;
      statistics: Array<{ name: string; label: string; displayValue: string }>;
      players: Array<{
        athlete: { id: string; displayName: string; position: string };
        statistics: Array<{ name: string; description: string; displayValue: string }>;
      }>;
    }
  ];
}

interface GameSummary {
  id: string;
  drives: Array<{
    id: string;
    team: Team;
    displayResult: string;
    isScore: boolean;
    results: Array<{ type: { text: string }; text: string }>;
  }>;
}

interface PickCenterData {
  id: string;
  spread: { favored: Team; unfavored: Team; line: number; winner: string };
  moneyline: { home: number; away: number };
  total: { overOdds: number; underOdds: number; line: number };
}

interface PlayerRankings {
  results: Array<{
    id: string;
    name: string;
    position: string;
    grade: number;
    ranking: number;
    state: string;
    school: string;
    committedTo: string;
    year: number;
  }>;
}

interface SchoolRankings {
  results: Array<{
    school: Team;
    class: number;
    totalCommits: number;
    avgRating: number;
    composite: number;
    ranking: number;
  }>;
}

interface SchoolCommits {
  commits: Array<{
    name: string;
    position: string;
    state: string;
    height: string;
    weight: number;
    year: number;
    rating: number;
    grade: number;
  }>;
}

interface CFBRankings {
  polls: Array<{
    poll: string;
    season: { year: number };
    week: { number: number };
    results: Array<{
      team: Team;
      rank: number;
      previousRank: number;
      points: number;
      firstPlaceVotes: number;
    }>;
  }>;
}

interface ScheduleData {
  id: string;
  date: string;
  name: string;
  competitions: Array<{ status: { type: { name: string } } }>;
  competitors: [Team, Team];
}

// interface GameScoreboard extends Game {}

interface ConferenceData {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  subConference: { id: string; name: string };
}

interface TeamStandings {
  team: Team;
  conference: ConferenceData;
  stats: Array<{ name: string; value: number; displayValue: string }>;
}

interface TeamInfo {
  team: Team;
  record: string;
  ranking: number;
  logo: string;
  color: string;
  alternateColor: string;
  venue: { name: string; capacity: number };
  coach: { name: string; experience: number };
}

interface TeamRoster {
  team: Team;
  athletes: Array<{
    id: string;
    uid: string;
    displayName: string;
    firstName: string;
    lastName: string;
    position: string;
    jersey: string;
    height: string;
    weight: number;
    age: number;
    year: string;
    hometown: string;
  }>;
}   