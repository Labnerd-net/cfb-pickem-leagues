import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData, createTestGame, createTestPick, testDb } from '../db-utils.js';
import { sql } from 'drizzle-orm';
import adminRoutes from '../../src/routes/admin.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/admin', adminRoutes);
app.onError((err, c) => {
	if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
	return c.json({ error: 'An unexpected error occurred' }, 500);
});

async function makeToken(roles: string[], userId = 1) {
	return sign(
		{
			sub: userId,
			email: roles.includes('admin') ? 'admin@test.com' : 'user@test.com',
			displayName: roles.includes('admin') ? 'Test Admin' : 'Test User',
			roles,
			exp: Math.floor(Date.now() / 1000) + 3600,
		},
		TEST_JWT_SECRET,
		'HS256',
	);
}

describe('GET /api/admin/users/export', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	it('returns 401 with no auth', async () => {
		const res = await app.request('/api/admin/users/export');
		expect(res.status).toBe(401);
	});

	it('returns 403 for non-admin user', async () => {
		const token = await makeToken(['user'], 2);
		const res = await app.request('/api/admin/users/export', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(403);
	});

	it('returns user list with zero pick totals when no picks exist', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/users/export', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { users: { userId: number; total: number; correct: number; accuracy: number }[] };
		expect(Array.isArray(body.users)).toBe(true);
		expect(body.users.length).toBeGreaterThan(0);
		// All users should have zero picks
		body.users.forEach(u => {
			expect(u.total).toBe(0);
			expect(u.correct).toBe(0);
			expect(u.accuracy).toBe(0);
		});
	});

	it('returns correct pick totals when picks exist', async () => {
		// Create a game and a correct pick for user 1
		const game = await createTestGame(1, 2024, 'Home', 'Away', true);
		const gameId = (game as { game_id: number }).game_id;
		await createTestPick(1, gameId);
		// Mark the game complete with home_team winning (user 1 picked home_team)
		await testDb.execute(sql`
			UPDATE "admin"."games" SET completed = true, winning_team = 'home_team', home_points = 21, away_points = 14
			WHERE game_id = ${gameId}
		`);

		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/users/export', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { users: { userId: number; total: number; correct: number; accuracy: number }[] };
		const user1 = body.users.find(u => u.userId === 1);
		expect(user1).toBeDefined();
		expect(user1!.total).toBe(1);
		expect(user1!.correct).toBe(1);
		expect(user1!.accuracy).toBe(1);

		// User 2 should still have zero picks
		const user2 = body.users.find(u => u.userId === 2);
		expect(user2).toBeDefined();
		expect(user2!.total).toBe(0);
		expect(user2!.correct).toBe(0);
		expect(user2!.accuracy).toBe(0);
	});

	it('each user row has required fields', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/users/export', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { users: Record<string, unknown>[] };
		body.users.forEach(u => {
			expect(u).toHaveProperty('userId');
			expect(u).toHaveProperty('displayName');
			expect(u).toHaveProperty('email');
			expect(u).toHaveProperty('roles');
			expect(u).toHaveProperty('total');
			expect(u).toHaveProperty('correct');
			expect(u).toHaveProperty('accuracy');
		});
	});
});
