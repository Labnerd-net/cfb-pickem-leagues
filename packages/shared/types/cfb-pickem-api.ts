export type Role = "user" | "admin";
export type Team = "home_team" | "away_team" | "pending";
export type Classification = "fbs" | "fcs" | "d1" | "d2" | "d3";
export type DataSource = "ncaa" | "cfbd" | "sdv";
export type SeasonType =
  | "regular"
  | "postseason"
  | "both"
  | "allstar"
  | "spring_regular"
  | "spring_postseason";

export interface Credentials {
  email: string;
  password: string;
}

export interface RegistrationData extends Credentials {
  displayName: string;
}

export interface RegistrationFormData extends RegistrationData {
  confirmPassword: string;
}

export interface JwtData {
  sub: number;
  email: string;
  displayName: string;
  roles: Role[];
  exp: number;
}

export interface ProfileData {
  userId: number;
  email: string;
  displayName: string;
  roles: Role[];
}

export interface UserData extends ProfileData {
  passwordHash: string;
}

export interface UserDbData extends UserData {
  createdAt: Date;
}

export interface UserGameData {
  userId: number;
  gameId: number;
  cfbdGameId: number | null;
  ncaaGameId: string | null;
  weekNumber: number;
  year: number;
  seasonType: SeasonType;
  completed: boolean;
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  winningTeam: Team;
  startTime: Date | null;
  teamChosen: Team;
}

export interface UserDbGameData extends UserGameData {
  createdAt: Date;
}

export interface AdminWeekData {
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
  gameId: number;
  cfbdGameId: number | null;
  ncaaGameId: string | null;
  picked: boolean;
  weekNumber: number;
  year: number;
  seasonType: SeasonType;
  completed: boolean;
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  winningTeam: Team;
  startTime: Date | null;
}

export interface AdminDbGameData extends AdminGameData {
  createdAt: Date;
}

export interface UserGamePicks {
  game: number;
  pick: "home_team" | "away_team";
}


export interface WeekIdentifier {
  year: number;
  week: number;
}

export interface PickedGamesRequest extends WeekIdentifier {
  games: number[];
}

export interface AllUserGamePicksRequest extends WeekIdentifier {
  games: UserGamePicks[];
}

export interface WeekQuery extends WeekIdentifier {
  seasonType: SeasonType;
}

export interface PickedGamesData extends WeekQuery {
  games: number[];
}

export interface AllUserGamePicks extends WeekQuery {
  games: UserGamePicks[];
}