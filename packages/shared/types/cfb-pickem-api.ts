export type Team = 'home_team' | 'away_team' | 'pending';
export type SeasonType = 'regular' | 'postseason' | 'both' | 'allstar' | 'spring_regular' | 'spring_postseason';
export type Classification = 'fbs' | 'fcs' | 'd1' | 'd2' | 'd3';
export type DataSource = 'ncaa' | 'cfbd' | 'sdv';

export interface UserFormData {
  email: string;
  password: string;
}

export interface UserData {
  userId: number;
  email: string;
  passwordHash: string;
  isAdmin: boolean;
}

export interface UserDbData extends UserData {
  createdAt: Date;
}

export interface UserGameData {
  gameId: number;
  userId: number;
  weekId: number;
  weekNumber: number;
  year: number;
  seasonType: SeasonType;
  completed: boolean;
  homeTeam: string;
  awayTeam: string;
  homePoints: number;
  awayPoints: number;
  winningTeam: Team;
  teamChosen: Team;
}

export interface UserDbGameData extends UserGameData {
  createdAt: Date;
}

export interface AdminWeekData {
  weekId: number;
  weekNumber: number;
  year: number;
  seasonType: SeasonType;
  weekStart: string;
  weekEnd: string;
}

export interface AdminDbWeekData extends AdminWeekData {
  createdAt: Date;
}

export interface AdminGameData {
  weekId: number;
  gameId: number;
  picked: boolean;
  weekNumber: number;
  year: number;
  seasonType: SeasonType;
  completed: boolean;
  homeTeam: string;
  awayTeam: string;
  homePoints: number;
  awayPoints: number;
  winningTeam: Team;
}

export interface AdminDbGameData extends AdminGameData {
  createdAt: Date;
}

export interface WeekIdData {
  year: number;
  week: number;
  seasonType: SeasonType;
}

export interface PickedGamesData extends WeekIdData {
  games: number[];
}

export interface UserGamePicks {
  game: number;
  pick: 'home_team' | 'away_team';
}

export interface AllUserGamePicks extends WeekIdData {
  games: UserGamePicks[];
}
