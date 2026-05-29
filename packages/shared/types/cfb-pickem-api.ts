export type Role = "user" | "admin";
export type NotificationType = "games_ready" | "picks_reminder_1h" | "picks_reminder_24h" | "rankings_updated" | "admin_broadcast";
export type NotificationChannel = "email" | "ntfy" | "telegram" | "discord";
export type Team = "home_team" | "away_team" | "pending" | "voided";
export type Classification = "fbs" | "fcs" | "d1" | "d2" | "d3";
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
  emailVerified: boolean;
  exp: number;
}

export interface NotificationPreference {
  userId: number;
  notificationType: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface NotificationSettings {
  preferences: NotificationPreference[];
  emailVerified: boolean;
}

export interface ProfileData {
  userId: number;
  email: string;
  displayName: string;
  roles: Role[];
  emailVerified: boolean;
}

export interface UserData extends ProfileData {
  passwordHash: string;
}

export interface UserDbData extends UserData {
  createdAt: Date;
  emailVerificationToken: string | null;
  emailVerificationSentAt: Date | null;
}

export interface UserGameData {
  userId: number;
  gameId: number;
  cfbdGameId: number | null;
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
  gameId?: number;
  cfbdGameId: number | null;
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
  spread: number | null;
}

export interface AdminDbGameData extends AdminGameData {
  gameId: number;
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

export interface UserPickHistoryEntry {
  year: number;
  weekNumber: number;
  total: number;
  correct: number;
  incorrect: number;
  pending: number;
}

export interface UserPickHistoryResponse {
  history: UserPickHistoryEntry[];
}

export interface LeaderboardEntry {
  userId: number;
  displayName: string;
  total: number;
  correct: number;
  incorrect: number;
  pending: number;
  percentage: number | null; // null when total === 0
}

export interface WeekScoresEntry {
  userId: number;
  displayName: string;
  total: number;
  correct: number;
  incorrect: number;
  pending: number;
}

export interface MarkGameCompleteRequest {
  gameId: number;
  homePoints: number;
  awayPoints: number;
}

export interface NotificationLogEntry {
  id: number;
  userId: number;
  year: number;
  weekNumber: number;
  notificationType: NotificationType;
  channel: NotificationChannel;
  sentAt: string; // ISO string
  recipient: string; // "Broadcast" | displayName | "Deleted user"
}

export interface BroadcastChannelInfo {
  ntfy: { topicUrl: string } | null;
  telegram: { inviteUrl: string | null } | null;
  discord: { inviteUrl: string | null } | null;
}

export interface UpdateProfileRequest {
  displayName?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface CorrectGameScoreRequest {
  homePoints: number;
  awayPoints: number;
}

export interface UserExportEntry {
  userId: number;
  displayName: string;
  email: string;
  roles: Role[];
  total: number;
  correct: number;
  accuracy: number;
}

export interface AdminBroadcastRequest {
  subject: string;
  message: string;
  overrideEmailPreferences: boolean;
}

export type LeagueRole = 'admin' | 'member';

export interface LeagueData {
  leagueId: number;
  name: string;
  inviteCode?: string; // only present when current user is league admin
  memberCount: number;
  createdAt: string;
  role: LeagueRole;
}

export interface LeagueMemberData {
  userId: number;
  displayName: string;
  role: LeagueRole;
  joinedAt: string;
}