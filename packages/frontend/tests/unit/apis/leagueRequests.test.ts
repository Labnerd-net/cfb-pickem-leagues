import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server.js';
import { getLeagues, joinLeague } from '../../../src/apis/leagueRequests.js';

const mockLeague = {
	leagueId: 1,
	name: 'Default League',
	memberCount: 2,
	createdAt: '2024-01-01T00:00:00.000Z',
	role: 'admin' as const,
};

describe('getLeagues', () => {
	it('returns success with leagues on 200', async () => {
		const result = await getLeagues();

		expect(result.success).toBe(true);
		expect(result.data).toEqual([mockLeague]);
	});

	it('returns failure with error on 4xx', async () => {
		server.use(
			http.get('http://localhost:3000/api/leagues', () =>
				HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			),
		);

		const result = await getLeagues();

		expect(result.success).toBe(false);
		expect(result.error).toBe('Unauthorized');
	});

	it('returns failure with "Request failed" on network error', async () => {
		server.use(
			http.get('http://localhost:3000/api/leagues', () => HttpResponse.error()),
		);

		const result = await getLeagues();

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});

describe('joinLeague', () => {
	it('returns success with league data on 200', async () => {
		const result = await joinLeague('INVITE123');

		expect(result.success).toBe(true);
		expect(result.data?.leagueId).toBe(2);
		expect(result.data?.name).toBe('New League');
	});

	it('returns failure with status 404 for invalid invite code', async () => {
		server.use(
			http.post('http://localhost:3000/api/leagues/join', () =>
				HttpResponse.json({ error: 'League not found' }, { status: 404 }),
			),
		);

		const result = await joinLeague('BADCODE');

		expect(result.success).toBe(false);
		expect(result.status).toBe(404);
		expect(result.error).toBe('League not found');
	});

	it('returns failure with status 409 when already a member', async () => {
		server.use(
			http.post('http://localhost:3000/api/leagues/join', () =>
				HttpResponse.json({ error: 'Already a member' }, { status: 409 }),
			),
		);

		const result = await joinLeague('MYCODE');

		expect(result.success).toBe(false);
		expect(result.status).toBe(409);
		expect(result.error).toBe('Already a member');
	});

	it('returns failure with "Request failed" on network error', async () => {
		server.use(
			http.post('http://localhost:3000/api/leagues/join', () => HttpResponse.error()),
		);

		const result = await joinLeague('CODE');

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});
