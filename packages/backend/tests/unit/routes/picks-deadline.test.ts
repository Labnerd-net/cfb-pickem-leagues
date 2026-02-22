import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { seedTestData, createTestWeek, createTestGame, cleanDatabase } from '../../db-utils.js';
import * as dbUserFunctions from '../../../src/db/dbUserFunctions.js';
import { returnGame } from '../../../src/db/dbAdminFunctions.js';

// Mock auth middleware to bypass JWT validation
vi.mock('../../../src/utils/middleware.js', () => ({
	authMiddleware: vi.fn(async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
		c.set('jwtPayload', { sub: 1, email: 'test@test.com', roles: ['user'], exp: 9999999999 });
		await next();
	}),
	requireRole: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => { await next(); }),
	logger: vi.fn(async (_c: unknown, next: () => Promise<void>) => { await next(); }),
}));

// Helper to build a fresh app for each test (so envVars can be re-mocked per test)
async function buildApp(ignoreDeadline = false) {
	vi.doMock('../../../src/utils/envVars.js', () => ({
		ignorePickDeadline: ignoreDeadline,
		jwtSecret: 'test-secret',
		jwtAlgorithm: 'HS256',
		jwtExpirationDays: 7,
		getJwtExpirationSeconds: () => 9999999999,
		bcryptSaltRounds: 10,
		dataSource: 'ncaa',
		cfbdApiKey: '',
		logLevel: 'silent',
		isProduction: false,
		serverPort: 3000,
		clientURLs: ['http://localhost:5173'],
	}));

	// Re-import user router with updated mock
	const { default: userRouter } = await import('../../../src/routes/user.js');
	const app = new Hono();
	app.route('/user', userRouter);
	// Add error handler for HTTPException
	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ error: err.message }, err.status);
		}
		return c.json({ error: 'Internal server error' }, 500);
	});
	return app;
}

function makePicksRequest(gameId: number, year = 2024, week = 1) {
	return new Request('http://localhost/user/picks', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: 'auth_token=fake' },
		body: JSON.stringify({
			year,
			week,
			seasonType: 'regular',
			games: [{ game: gameId, pick: 'home_team' }],
		}),
	});
}

describe('POST /picks deadline enforcement', () => {
	beforeEach(async () => {
		vi.resetModules();
		await cleanDatabase();
		await seedTestData();
		await createTestWeek(1, 2024, 'regular');
	});

	it('accepts pick when startTime is in the future', async () => {
		const futureTime = new Date(Date.now() + 60 * 60 * 1000); // +1 hour
		const row = await createTestGame(1, 2024, 'Home A', 'Away A', true, false, futureTime);
		const gameId = (row as { game_id: number }).game_id;

		const app = await buildApp(false);
		const res = await app.request(makePicksRequest(gameId));
		expect(res.status).toBe(200);
	});

	it('rejects pick (422) when startTime is in the past', async () => {
		const pastTime = new Date(Date.now() - 60 * 60 * 1000); // -1 hour
		const row = await createTestGame(1, 2024, 'Home B', 'Away B', true, false, pastTime);
		const gameId = (row as { game_id: number }).game_id;

		const app = await buildApp(false);
		const res = await app.request(makePicksRequest(gameId));
		expect(res.status).toBe(422);
		const body = await res.json() as { error: string };
		expect(body.error).toContain('locked');
		expect(body.error).toContain(String(gameId));
	});

	it('rejects pick (422) when startTime is null', async () => {
		const row = await createTestGame(1, 2024, 'Home C', 'Away C', true, false, null);
		const gameId = (row as { game_id: number }).game_id;

		const app = await buildApp(false);
		const res = await app.request(makePicksRequest(gameId));
		expect(res.status).toBe(422);
		const body = await res.json() as { error: string };
		expect(body.error).toContain('no start time');
	});

	it('rejects on first locked game in a mixed batch', async () => {
		const futureTime = new Date(Date.now() + 60 * 60 * 1000);
		const pastTime = new Date(Date.now() - 60 * 60 * 1000);

		const rowA = await createTestGame(1, 2024, 'Home D', 'Away D', true, false, pastTime);
		const rowB = await createTestGame(1, 2024, 'Home E', 'Away E', true, false, futureTime);
		const gameIdA = (rowA as { game_id: number }).game_id;
		const gameIdB = (rowB as { game_id: number }).game_id;

		const app = await buildApp(false);
		const req = new Request('http://localhost/user/picks', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: 'auth_token=fake' },
			body: JSON.stringify({
				year: 2024,
				week: 1,
				seasonType: 'regular',
				games: [
					{ game: gameIdA, pick: 'home_team' },
					{ game: gameIdB, pick: 'away_team' },
				],
			}),
		});
		const res = await app.request(req);
		expect(res.status).toBe(422);
	});

	it('bypasses deadline when PICKS_IGNORE_DEADLINE=true', async () => {
		const pastTime = new Date(Date.now() - 60 * 60 * 1000);
		const row = await createTestGame(1, 2024, 'Home F', 'Away F', true, false, pastTime);
		const gameId = (row as { game_id: number }).game_id;

		const app = await buildApp(true);
		const res = await app.request(makePicksRequest(gameId));
		expect(res.status).toBe(200);
	});
});
