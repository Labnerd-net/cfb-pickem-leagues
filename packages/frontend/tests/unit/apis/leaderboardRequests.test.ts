import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server.js';
import { getLeaderboard, getWeekScores } from '../../../src/apis/leaderboardRequests.js';

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
		const result = await getLeaderboard(2025, 1);

		expect(result.success).toBe(true);
		expect(result.data).toEqual(mockEntries);
	});

	it('returns failure with error on 4xx', async () => {
		server.use(
			http.get('http://localhost:3000/api/leaderboard', () =>
				HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			),
		);

		const result = await getLeaderboard(2025, 1);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Unauthorized');
	});

	it('returns failure with "Request failed" on network error', async () => {
		server.use(
			http.get('http://localhost:3000/api/leaderboard', () =>
				HttpResponse.error(),
			),
		);

		const result = await getLeaderboard(2025, 1);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});

const mockScores = [
	{ userId: 1, displayName: 'Test User', total: 5, correct: 3, incorrect: 1, pending: 1 },
];

describe('getWeekScores', () => {
	it('returns success with data on 200', async () => {
		const result = await getWeekScores(2025, 1, 1);

		expect(result.success).toBe(true);
		expect(result.data).toEqual(mockScores);
	});

	it('returns failure with error on 4xx', async () => {
		server.use(
			http.get('http://localhost:3000/api/leaderboard/scores', () =>
				HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			),
		);

		const result = await getWeekScores(2025, 1, 1);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Unauthorized');
	});

	it('returns failure with "Request failed" on network error', async () => {
		server.use(
			http.get('http://localhost:3000/api/leaderboard/scores', () =>
				HttpResponse.error(),
			),
		);

		const result = await getWeekScores(2025, 1, 1);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});
