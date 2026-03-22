import type {
  AdminDbGameData,
  AdminDbWeekData,
  WeekIdentifier,
  PickedGamesRequest,
  ProfileData,
  MarkGameCompleteRequest,
  NotificationChannel,
  NotificationLogEntry,
  NotificationType,
} from '@shared/types/cfb-pickem-api';
import { client } from '../lib/api';

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
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface GetWeeksResponse {
  success: boolean;
  data?: AdminDbWeekData[];
  error?: string;
}

export async function getWeeksForYear(year: number): Promise<GetWeeksResponse> {
  try {
    const res = await client.api.admin.weeks.$get({ query: { year: String(year) } });
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const body = await res.json();
    return { success: true, data: body.weeks as unknown as AdminDbWeekData[] };
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
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface GetGamesResponse {
  success: boolean;
  data?: AdminDbGameData[];
  error?: string;
}

export async function getGamesForWeek(weekData: WeekIdentifier): Promise<GetGamesResponse> {
  try {
    const res = await client.api.admin.games.$get({
      query: { year: String(weekData.year), weekNumber: String(weekData.week) },
    });
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const body = await res.json();
    return { success: true, data: body.weekGames as unknown as AdminDbGameData[] };
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
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const body = await res.json();
    return { success: true, data: body.allUserProfiles as unknown as ProfileData[] };
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
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const body = await res.json();
    return { success: true, data: (body as unknown as { user: ProfileData }).user };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface MarkGameCompleteResponse {
  success: boolean;
  data?: AdminDbGameData;
  error?: string;
}

export async function markGameComplete(
  request: MarkGameCompleteRequest
): Promise<MarkGameCompleteResponse> {
  try {
    const res = await client.api.admin.games.complete.$post({ json: request });
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const body = await res.json();
    return { success: true, data: (body as unknown as { game: AdminDbGameData }).game };
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
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const body = await res.json();
    return {
      success: true,
      data: body as unknown as { entries: NotificationLogEntry[]; total: number },
    };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function setPickedGames(pickedData: PickedGamesRequest): Promise<SetPicksResponse> {
  try {
    const res = await client.api.admin.picks.$post({ json: pickedData });
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}
