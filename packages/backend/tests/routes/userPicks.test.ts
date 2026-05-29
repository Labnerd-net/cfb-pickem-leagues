import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData, createTestWeek, createTestGame, createLeagueGame } from '../db-utils.js';
import userRoutes from '../../src/routes/user.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/user', userRoutes);
app.onError((err, c) => {
	if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
	return c.json({ error: 'An unexpected error occurred' }, 500);
});

async function makeToken() {
	return sign(
		{
			sub: 1,
			email: 'user@test.com',
			displayName: 'Test User',
			roles: ['user'],
			exp: Math.floor(Date.now() / 1000) + 3600,
		},
		TEST_JWT_SECRET,
		'HS256',
	);
}

function makePicksBody(gameId: number, leagueId = 1) {
	return JSON.stringify({
		year: 2024,
		week: 1,
		leagueId,
		games: [{ game: gameId, pick: 'home_team' }],
	});
}

describe('POST /api/user/picks — auth enforcement', () => {
	it('returns 401 when no cookie is present (not 400)', async () => {
		const res = await app.request('/api/user/picks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: makePicksBody(1),
		});
		expect(res.status).toBe(401);
	});
});

describe('POST /api/user/picks — curated game enforcement', () => {
	beforeAll(async () => {
		await seedTestData();
		await createTestWeek(1, 2024, 'regular');
	});

	it('returns 422 when game is not in the league pool', async () => {
		// Create a game that is NOT in the league pool
		const row = await createTestGame(1, 2024, 'Home X', 'Away X', false, new Date(Date.now() + 60 * 60 * 1000));
		const gameId = (row as { game_id: number }).game_id;
		// intentionally NOT calling createLeagueGame — game not in pool

		const token = await makeToken();
		const res = await app.request('/api/user/picks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: `auth_token=${token}` },
			body: makePicksBody(gameId),
		});

		expect(res.status).toBe(422);
		const body = await res.json() as { error: string };
		expect(body.error).toContain('not in this league');
		expect(body.error).toContain(String(gameId));
	});
});
