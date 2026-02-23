import type { LeaderboardEntry } from '@shared/types/cfb-pickem-api.js';
import { client } from '../lib/api';

export interface LeaderboardResponse {
  success: boolean;
  data?: LeaderboardEntry[];
  error?: string;
}

export async function getLeaderboard(year: number): Promise<LeaderboardResponse> {
  try {
    const res = await client.api.leaderboard.$get({ query: { year: String(year) } });
    if (!res.ok) {
      const body = await res.json() as unknown as { error: string };
      return { success: false, error: body.error };
    }
    const body = await res.json();
    return { success: true, data: body.leaderboard as unknown as LeaderboardEntry[] };
  } catch {
    return { success: false, error: 'Request failed' };
  }
}
