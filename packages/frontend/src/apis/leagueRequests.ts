import type { InferResponseType } from 'hono/client';
import type { LeagueData, LeagueMemberData, LeagueRole, LeagueChannelConfig } from '@shared/types/cfb-pickem-api.js';
import { client } from '../lib/api';

type LeaguesRPC = InferResponseType<typeof client.api.leagues.$get, 200>;
type JoinLeagueRPC = InferResponseType<typeof client.api.leagues.join.$post, 200>;
type LeagueMembersRPC = InferResponseType<typeof client.api.leagues[':leagueId']['members']['$get'], 200>;
type CreateLeagueRPC = InferResponseType<typeof client.api.leagues.$post, 201>;

export type LeaguesListWire = LeaguesRPC['leagues'];
export type JoinedLeagueWire = JoinLeagueRPC['league'];
export type LeagueMemberWire = LeagueMembersRPC['members'][number];
export type CreatedLeagueWire = CreateLeagueRPC['league'];

async function extractError(res: { json(): Promise<unknown> }): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? 'Request failed';
  } catch {
    return 'Request failed';
  }
}

export interface GetLeaguesResponse {
  success: boolean;
  data?: LeagueData[];
  error?: string;
}

export async function getLeagues(): Promise<GetLeaguesResponse> {
  try {
    const res = await client.api.leagues.$get();
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = await res.json();
    return { success: true, data: body.leagues as LeagueData[] };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface JoinLeagueResponse {
  success: boolean;
  data?: LeagueData;
  error?: string;
  status?: number;
}

export async function joinLeague(inviteCode: string): Promise<JoinLeagueResponse> {
  try {
    const res = await client.api.leagues.join.$post({ json: { inviteCode } });
    const status = res.status;
    if (!res.ok) return { success: false, error: await extractError(res), status };
    const body = await res.json();
    return { success: true, data: body.league as LeagueData };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface GetLeagueMembersResponse {
  success: boolean;
  data?: LeagueMemberData[];
  error?: string;
}

export async function getLeagueMembers(leagueId: number): Promise<GetLeagueMembersResponse> {
  try {
    const res = await client.api.leagues[':leagueId'].members.$get({
      param: { leagueId: String(leagueId) },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = await res.json();
    return { success: true, data: body.members as LeagueMemberData[] };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface MemberMutationResponse {
  success: boolean;
  error?: string;
  status?: number;
}

export async function updateMemberRole(
  leagueId: number,
  userId: number,
  role: LeagueRole,
): Promise<MemberMutationResponse> {
  try {
    const res = await client.api.leagues[':leagueId'].members[':userId'].$patch({
      param: { leagueId: String(leagueId), userId: String(userId) },
      json: { role },
    });
    const status = res.status;
    if (!res.ok) return { success: false, error: await extractError(res), status };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function removeMember(
  leagueId: number,
  userId: number,
): Promise<MemberMutationResponse> {
  try {
    const res = await client.api.leagues[':leagueId'].members[':userId'].$delete({
      param: { leagueId: String(leagueId), userId: String(userId) },
    });
    const status = res.status;
    if (!res.ok) return { success: false, error: await extractError(res), status };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function updateLeagueName(
  leagueId: number,
  name: string,
): Promise<MemberMutationResponse> {
  try {
    const res = await client.api.leagues[':leagueId'].$patch({
      param: { leagueId: String(leagueId) },
      json: { name },
    });
    const status = res.status;
    if (!res.ok) return { success: false, error: await extractError(res), status };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface RegenerateInviteCodeResponse {
  success: boolean;
  data?: string;
  error?: string;
}

export async function regenerateInviteCode(
  leagueId: number,
): Promise<RegenerateInviteCodeResponse> {
  try {
    const res = await client.api.leagues[':leagueId'].invite.regenerate.$post({
      param: { leagueId: String(leagueId) },
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = await res.json();
    return { success: true, data: body.inviteCode };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface CreateLeagueResponse {
  success: boolean;
  data?: LeagueData & { inviteCode: string };
  error?: string;
}

export interface LeagueChannelResponse {
  success: boolean;
  data?: LeagueChannelConfig;
  error?: string;
}

export async function getLeagueChannels(leagueId: number): Promise<LeagueChannelResponse> {
  try {
    const res = await client.api.leagues[':leagueId'].channels.$get({ param: { leagueId: String(leagueId) } });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const data = await res.json();
    return { success: true, data: data as LeagueChannelConfig };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function updateLeagueChannels(leagueId: number, config: Partial<LeagueChannelConfig>): Promise<LeagueChannelResponse> {
  try {
    const res = await client.api.leagues[':leagueId'].channels.$patch({
      param: { leagueId: String(leagueId) },
      json: config,
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const data = await res.json();
    return { success: true, data: data as LeagueChannelConfig };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export interface LeagueBroadcastResponse {
  success: boolean;
  error?: string;
}

export async function sendLeagueBroadcast(
  leagueId: number,
  body: { subject: string; message: string; overrideEmailPreferences: boolean }
): Promise<LeagueBroadcastResponse> {
  try {
    const res = await client.api.leagues[':leagueId'].broadcast.$post({
      param: { leagueId: String(leagueId) },
      json: body,
    });
    if (!res.ok) return { success: false, error: await extractError(res) };
    return { success: true };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}

export async function createLeague(name: string): Promise<CreateLeagueResponse> {
  try {
    const res = await client.api.leagues.$post({ json: { name } });
    if (!res.ok) return { success: false, error: await extractError(res) };
    const body = await res.json();
    const league = body.league;
    return {
      success: true,
      data: {
        leagueId: league.leagueId,
        name: league.name,
        inviteCode: league.inviteCode ?? '',
        memberCount: league.memberCount,
        createdAt: league.createdAt,
        role: league.role,
      },
    };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}
