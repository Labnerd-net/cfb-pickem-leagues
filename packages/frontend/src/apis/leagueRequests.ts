import type { InferResponseType } from 'hono/client';
import type { LeagueData } from '@shared/types/cfb-pickem-api.js';
import { client } from '../lib/api';

type LeaguesRPC = InferResponseType<typeof client.api.leagues.$get, 200>;
type JoinLeagueRPC = InferResponseType<typeof client.api.leagues.join.$post, 200>;

export type LeaguesListWire = LeaguesRPC['leagues'];
export type JoinedLeagueWire = JoinLeagueRPC['league'];

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
