import type {
  AdminDbGameData,
  AdminDbWeekData,
  AllUserGamePicksRequest,
  NotificationChannel,
  NotificationSettings,
  NotificationType,
  ProfileData,
  UserDbGameData,
  UserPickHistoryResponse,
  WeekIdentifier,
} from '@shared/types/cfb-pickem-api.js';
import { client } from '../lib/api';

export interface ProfileResponse {
  success: boolean;
  data?: ProfileData;
  error?: string;
}

export async function getUserProfile(): Promise<ProfileResponse> {
  try {
    const res = await client.api.user.profile.$get();
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
  data?: { weeks: AdminDbWeekData[] };
  error?: string;
}

export async function getWeeksForYear(year: number): Promise<GetWeeksResponse> {
  try {
    const res = await client.api.user.weeks.$get({ query: { year: String(year) } });
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const body = await res.json();
    return { success: true, data: { weeks: body.weeks as unknown as AdminDbWeekData[] } };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface UserGameResponse {
  success: boolean;
  data?: UserDbGameData[];
  error?: string;
}

export async function getUserPicks(weekData: WeekIdentifier): Promise<UserGameResponse> {
  try {
    const res = await client.api.user.picks.$get({
      query: { year: String(weekData.year), week: String(weekData.week) },
    });
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const body = await res.json();
    return { success: true, data: body.picks as unknown as UserDbGameData[] };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface AdminGameResponse {
  success: boolean;
  data?: AdminDbGameData[];
  error?: string;
}

export async function getPickedGames(weekData: WeekIdentifier): Promise<AdminGameResponse> {
  try {
    const res = await client.api.user.games.$get({
      query: { year: String(weekData.year), week: String(weekData.week) },
    });
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const body = await res.json();
    return { success: true, data: body.pickedGames as unknown as AdminDbGameData[] };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface PickHistoryResponse {
  success: boolean;
  data?: UserPickHistoryResponse;
  error?: string;
}

export async function getUserPickHistory(year: number): Promise<PickHistoryResponse> {
  try {
    const res = await client.api.user.history.$get({ query: { year: String(year) } });
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const data = await res.json();
    return { success: true, data: data as unknown as UserPickHistoryResponse };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface PicksResponse {
  success: boolean;
  data?: { status: string };
  error?: string;
}

export async function postUserPicks(picks: AllUserGamePicksRequest): Promise<PicksResponse> {
  try {
    const res = await client.api.user.picks.$post({ json: picks });
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

export interface NotificationSettingsResponse {
  success: boolean;
  data?: NotificationSettings;
  error?: string;
}

export async function getNotificationSettings(): Promise<NotificationSettingsResponse> {
  try {
    const res = await client.api.user.notifications.preferences.$get();
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const data = (await res.json()) as unknown as NotificationSettings;
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function updateNotificationPreference(pref: {
  notificationType: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await client.api.user.notifications.preferences.$patch({ json: pref });
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function updateNtfyUrl(
  ntfyServerUrl: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await client.api.user.notifications['ntfy-url'].$patch({ json: { ntfyServerUrl } });
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function sendTestNtfy(): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const res = await client.api.user.notifications['test-ntfy'].$post();
    if (!res.ok) {
      const body = (await res.json()) as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const data = (await res.json()) as unknown as { status: string };
    return { success: true, status: data.status };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}
