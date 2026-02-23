import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server.js';
import { getLeaderboard } from '../../../src/apis/leaderboardRequests.js';

const mockEntries = [
	{
		userId: 1,
		displayName: 'Test User',
		total: 10,
		correct: 7,
		incorrect: 3,
		pending: 0,
		percentage: 0.7,
	},
];

describe('getLeaderboard', () => {
	it('returns success with data on 200', async () => {
		const result = await getLeaderboard(2025);

		expect(result.success).toBe(true);
		expect(result.data).toEqual(mockEntries);
	});

	it('returns failure with error on 4xx', async () => {
		server.use(
			http.get('http://localhost:3000/api/leaderboard', () =>
				HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			),
		);

		const result = await getLeaderboard(2025);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Unauthorized');
	});

	it('returns failure with "Request failed" on network error', async () => {
		server.use(
			http.get('http://localhost:3000/api/leaderboard', () =>
				HttpResponse.error(),
			),
		);

		const result = await getLeaderboard(2025);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});
