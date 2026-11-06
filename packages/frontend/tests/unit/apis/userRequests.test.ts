import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server.js';
import { postUserPicks } from '../../../src/apis/userRequests.js';

const request = { year: 2024, week: 1, leagueId: 1, games: [{ game: 1, pick: 'home_team' as const }] };

describe('postUserPicks', () => {
  it('returns a string error for a string error body', async () => {
    server.use(
      http.post('http://localhost:3000/api/user/picks', () =>
        HttpResponse.json({ error: 'Game 1 is locked' }, { status: 422 }),
      ),
    );

    const result = await postUserPicks(request);

    expect(result).toEqual({ success: false, error: 'Game 1 is locked' });
  });

  it('never returns a non-string error for a Zod validation failure body', async () => {
    server.use(
      http.post('http://localhost:3000/api/user/picks', () =>
        HttpResponse.json(
          { success: false, error: { name: 'ZodError', message: '[{"code":"too_big"}]' } },
          { status: 400 },
        ),
      ),
    );

    const result = await postUserPicks(request);

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});
