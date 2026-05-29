import type { InferResponseType } from 'hono/client';
import type {
  WeekIdentifier,
  ProfileData,
  MarkGameCompleteRequest,
  CorrectGameScoreRequest,
  NotificationChannel,
  NotificationLogEntry,
  NotificationType,
  UserExportEntry,
  AdminBroadcastRequest,
} from '@shared/types/cfb-pickem-api';
import { client } from '../lib/api';

// Wire-format types derived from Hono RPC inference.
// Date fields (startTime, createdAt) are serialized as strings over JSON.
type GetWeeksRPC            = InferResponseType<typeof client.api.admin.weeks.$get, 200>;
type GetGamesRPC            = InferResponseType<typeof client.api.admin.games.$get, 200>;
type GetUsersRPC            = InferResponseType<typeof client.api.admin.users.$get, 200>;
type AdminUsersClient       = typeof client.api.admin.users;
type UpdateUserRolesRPC     = InferResponseType<AdminUsersClient[':id']['roles']['$patch'], 200>;
type MarkGameCompleteRPC    = InferResponseType<typeof client.api.admin.games.complete.$post, 200>;
type AdminGamesClient       = typeof client.api.admin.games;
type CorrectGameScoreRPC    = InferResponseType<AdminGamesClient[':gameId']['score']['$patch'], 200>;
type AdminClient            = typeof client.api.admin;
type GetNotificationLogsRPC = InferResponseType<AdminClient['notification-logs']['$get'], 200>;
type GetAdminExportRPC      = InferResponseType<typeof client.api.admin.users.export.$get, 200>;

export type AdminDbWeekDataWire = GetWeeksRPC['weeks'][number];
export type AdminDbGameDataWire = GetGamesRPC['weekGames'][number];

async function extractError(res: { json(): Promise<unknown> }): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? 'Request failed';
  } catch {
    return 'Request failed';
  }
}

export interface AddWeeksResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export async function addWeeksToYear(year: number): Promise<AddWeeksResponse> {
  try {
    const res = await client.api.admin.year[':year'].$post({
      param: { year: String(year) },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface DeleteYearResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export async function deleteYear(year: number): Promise<DeleteYearResponse> {
  try {
    const res = await client.api.admin.year[':year'].$delete({
      param: { year: String(year) },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface GetWeeksResponse {
  success: boolean;
  data?: AdminDbWeekDataWire[];
  error?: string;
}

export async function getWeeksForYear(year: number): Promise<GetWeeksResponse> {
  try {
    const res = await client.api.admin.weeks.$get({ query: { year: String(year) } });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = (await res.json()) as GetWeeksRPC;
    return { success: true, data: body.weeks };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface AddGamesResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export async function addGamesToWeek(weekData: WeekIdentifier): Promise<AddGamesResponse> {
  try {
    const res = await client.api.admin.week.$post({ json: weekData });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface GetGamesResponse {
  success: boolean;
  data?: AdminDbGameDataWire[];
  error?: string;
}

export async function getGamesForWeek(weekData: WeekIdentifier): Promise<GetGamesResponse> {
  try {
    const res = await client.api.admin.games.$get({
      query: { year: String(weekData.year), weekNumber: String(weekData.week) },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = (await res.json()) as GetGamesRPC;
    return { success: true, data: body.weekGames };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface GetUsersResponse {
  success: boolean;
  data?: ProfileData[];
  error?: string;
}

export async function getUsers(): Promise<GetUsersResponse> {
  try {
    const res = await client.api.admin.users.$get();
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = (await res.json()) as GetUsersRPC;
    return { success: true, data: body.allUserProfiles as ProfileData[] };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface SetPicksResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export interface UpdateUserRolesResponse {
  success: boolean;
  data?: ProfileData;
  error?: string;
}

export async function updateUserRoles(
  userId: number,
  roles: ProfileData['roles']
): Promise<UpdateUserRolesResponse> {
  try {
    const res = await client.api.admin.users[':id'].roles.$patch({
      param: { id: String(userId) },
      json: { roles },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = (await res.json()) as UpdateUserRolesRPC;
    return { success: true, data: body.user as ProfileData };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function resetUserPassword(
  userId: number,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await client.api.admin.users[':id'].password.$patch({
      param: { id: String(userId) },
      json: { password },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface MarkGameCompleteResponse {
  success: boolean;
  data?: AdminDbGameDataWire;
  error?: string;
}

export async function markGameComplete(
  request: MarkGameCompleteRequest
): Promise<MarkGameCompleteResponse> {
  try {
    const res = await client.api.admin.games.complete.$post({ json: request });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = (await res.json()) as MarkGameCompleteRPC;
    return { success: true, data: body.game };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface GetNotificationLogsResponse {
  success: boolean;
  data?: { entries: NotificationLogEntry[]; total: number };
  error?: string;
}

export async function getNotificationLogs(
  params: { limit?: number; offset?: number; channel?: NotificationChannel; notificationType?: NotificationType } = {}
): Promise<GetNotificationLogsResponse> {
  try {
    const res = await client.api.admin['notification-logs'].$get({
      query: {
        limit: params.limit !== undefined ? String(params.limit) : undefined,
        offset: params.offset !== undefined ? String(params.offset) : undefined,
        channel: params.channel,
        notificationType: params.notificationType,
      },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = (await res.json()) as GetNotificationLogsRPC;
    return {
      success: true,
      data: body as { entries: NotificationLogEntry[]; total: number },
    };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface CorrectGameScoreResponse {
  success: boolean;
  data?: AdminDbGameDataWire;
  error?: string;
}

export async function correctGameScore(
  gameId: number,
  request: CorrectGameScoreRequest
): Promise<CorrectGameScoreResponse> {
  try {
    const res = await client.api.admin.games[':gameId'].score.$patch({
      param: { gameId: String(gameId) },
      json: request,
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = (await res.json()) as CorrectGameScoreRPC;
    return { success: true, data: body.game };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface GetAdminExportResponse {
  success: boolean;
  data?: UserExportEntry[];
  error?: string;
}

export async function getAdminExport(): Promise<GetAdminExportResponse> {
  try {
    const res = await client.api.admin.users.export.$get();
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = (await res.json()) as GetAdminExportRPC;
    return { success: true, data: body.users as UserExportEntry[] };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface SendAdminBroadcastResponse {
  success: boolean;
  error?: string;
}

export async function sendAdminBroadcast(request: AdminBroadcastRequest): Promise<SendAdminBroadcastResponse> {
  try {
    const res = await client.api.admin.notifications.broadcast.$post({ json: request });
    if (!res.ok) return { success: false, error: await extractError(res) };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

// Phase 4: replace with per-league game selection via /api/admin/leagues/:leagueId/games
export async function setPickedGames(_pickedData: { year: number; week: number; games: number[] }): Promise<SetPicksResponse> {
  return { success: false, error: 'Game selection is now per-league (Phase 4)' };
}

// --- League Admin endpoints ---

type AdminLeaguesClient = typeof client.api.admin.leagues;
type GetLeagueGamesRPC = InferResponseType<AdminLeaguesClient[':leagueId']['games']['$get'], 200>;

export type LeagueGameWire = GetLeagueGamesRPC['games'][number];

export interface GetLeagueGamesResponse {
  success: boolean;
  data?: LeagueGameWire[];
  error?: string;
}

export async function getLeagueGamesForWeek(
  leagueId: number,
  year: number,
  weekNumber: number,
): Promise<GetLeagueGamesResponse> {
  try {
    const res = await client.api.admin.leagues[':leagueId'].games.$get({
      param: { leagueId: String(leagueId) },
      query: { year: String(year), weekNumber: String(weekNumber) },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = await res.json();
    return { success: true, data: body.games };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface LeagueGameMutationResponse {
  success: boolean;
  error?: string;
  status?: number;
}

export async function addGameToLeague(
  leagueId: number,
  gameId: number,
): Promise<LeagueGameMutationResponse> {
  try {
    const res = await client.api.admin.leagues[':leagueId'].games[':gameId'].$post({
      param: { leagueId: String(leagueId), gameId: String(gameId) },
    });
    const status = res.status;
    if (!res.ok) return { success: false, error: await extractError(res), status };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function removeGameFromLeague(
  leagueId: number,
  gameId: number,
): Promise<LeagueGameMutationResponse> {
  try {
    const res = await client.api.admin.leagues[':leagueId'].games[':gameId'].$delete({
      param: { leagueId: String(leagueId), gameId: String(gameId) },
    });
    const status = res.status;
    if (!res.ok) return { success: false, error: await extractError(res), status };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface MarkLeagueWeekCompleteResponse {
  success: boolean;
  data?: { completed: number };
  error?: string;
}

export async function markLeagueWeekComplete(
  leagueId: number,
  year: number,
  weekNumber: number,
): Promise<MarkLeagueWeekCompleteResponse> {
  try {
    const res = await client.api.admin.leagues[':leagueId'].games.complete.$post({
      param: { leagueId: String(leagueId) },
      query: { year: String(year), weekNumber: String(weekNumber) },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = await res.json();
    return { success: true, data: body };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

type LeagueScoreRPC = InferResponseType<AdminLeaguesClient[':leagueId']['games'][':gameId']['score']['$patch'], 200>;
export type LeagueGameCorrectedWire = LeagueScoreRPC['game'];

export interface CorrectLeagueGameScoreResponse {
  success: boolean;
  data?: LeagueGameCorrectedWire;
  error?: string;
}

export async function correctLeagueGameScore(
  leagueId: number,
  gameId: number,
  body: CorrectGameScoreRequest,
): Promise<CorrectLeagueGameScoreResponse> {
  try {
    const res = await client.api.admin.leagues[':leagueId'].games[':gameId'].score.$patch({
      param: { leagueId: String(leagueId), gameId: String(gameId) },
      json: body,
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const data = await res.json();
    return { success: true, data: data.game };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}
