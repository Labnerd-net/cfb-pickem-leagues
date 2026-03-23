import type { InferResponseType } from 'hono/client';
import type {
  AdminWeekData,
  AllUserGamePicksRequest,
  BroadcastChannelInfo,
  NotificationSettings,
  NotificationType,
  ProfileData,
  UpdateProfileRequest,
  UserPickHistoryResponse,
  WeekIdentifier,
} from '@shared/types/cfb-pickem-api.js';
import { client } from '../lib/api';

// Wire-format types derived from Hono RPC inference.
// Date fields (startTime, createdAt) are serialized as strings over JSON.
type UserPicksRPC = InferResponseType<typeof client.api.user.picks.$get, 200>;
type AdminGamesRPC = InferResponseType<typeof client.api.user.games.$get, 200>;
export type UserPickWire = UserPicksRPC['picks'][number];
export type AdminGameWire = AdminGamesRPC['pickedGames'][number];

async function extractError(res: { json(): Promise<unknown> }): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? 'Request failed';
  } catch {
    return 'Request failed';
  }
}

export interface ProfileResponse {
  success: boolean;
  data?: ProfileData;
  error?: string;
}

export async function getUserProfile(): Promise<ProfileResponse> {
  try {
    const res = await client.api.user.profile.$get();
    if (!res.ok) return { success: false, error: await extractError(res) };
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface GetWeeksResponse {
  success: boolean;
  data?: { weeks: AdminWeekData[] };
  error?: string;
}

export async function getWeeksForYear(year: number): Promise<GetWeeksResponse> {
  try {
    const res = await client.api.user.weeks.$get({ query: { year: String(year) } });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = await res.json();
    return { success: true, data: { weeks: body.weeks } };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface UserGameResponse {
  success: boolean;
  data?: UserPickWire[];
  error?: string;
}

export async function getUserPicks(weekData: WeekIdentifier): Promise<UserGameResponse> {
  try {
    const res = await client.api.user.picks.$get({
      query: { year: String(weekData.year), weekNumber: String(weekData.week) },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = await res.json();
    return { success: true, data: body.picks };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface AdminGameResponse {
  success: boolean;
  data?: AdminGameWire[];
  error?: string;
}

export async function getPickedGames(weekData: WeekIdentifier): Promise<AdminGameResponse> {
  try {
    const res = await client.api.user.games.$get({
      query: { year: String(weekData.year), weekNumber: String(weekData.week) },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = await res.json();
    return { success: true, data: body.pickedGames };
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
    if (!res.ok) return { success: false, error: await extractError(res) };
    const data = await res.json();
    return { success: true, data };
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
    if (!res.ok) return { success: false, error: await extractError(res) };
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
    if (!res.ok) return { success: false, error: await extractError(res) };
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface BroadcastChannelsResponse {
  success: boolean;
  data?: BroadcastChannelInfo;
  error?: string;
}

export async function getBroadcastChannels(): Promise<BroadcastChannelsResponse> {
  try {
    const res = await client.api.user.notifications.channels.$get();
    if (!res.ok) return { success: false, error: await extractError(res) };
    const data = await res.json();
    return { success: true, data };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function updateNotificationPreference(pref: {
  notificationType: Exclude<NotificationType, 'admin_broadcast'>;
  channel: 'email';
  enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await client.api.user.notifications.preferences.$patch({ json: pref });
    if (!res.ok) return { success: false, error: await extractError(res) };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function updateUserProfile(
  data: UpdateProfileRequest
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await client.api.user.profile.$patch({ json: data });
    if (!res.ok) return { success: false, error: await extractError(res) };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}
