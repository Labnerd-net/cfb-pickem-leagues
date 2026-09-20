import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData, cleanDatabase, testDb } from '../db-utils.js';
import authRoutes from '../../src/routes/auth.js';
import { clearRateLimitStore } from '../../src/utils/rateLimiter.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/auth', authRoutes);
app.onError((err, c) => {
	if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
	return c.json({ error: 'An unexpected error occurred' }, 500);
});

async function makeToken(overrides: Record<string, unknown> = {}) {
	return sign(
		{
			sub: 1,
			email: 'admin@test.com',
			displayName: 'Test Admin',
			roles: ['admin', 'user'],
			exp: Math.floor(Date.now() / 1000) + 3600,
			...overrides,
		},
		TEST_JWT_SECRET,
		'HS256',
	);
}

describe('POST /api/auth/login', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	it('sets auth_token cookie on successful login', async () => {
		const res = await app.request('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
		});

		expect(res.status).toBe(200);

		const setCookie = res.headers.get('set-cookie');
		expect(setCookie).toBeTruthy();
		expect(setCookie).toContain('auth_token=');
		expect(setCookie?.toLowerCase()).toContain('httponly');
		expect(setCookie?.toLowerCase()).toContain('samesite=strict');
	});

	it('returns 401 for invalid credentials', async () => {
		const res = await app.request('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'admin@test.com', password: 'wrongpassword' }),
		});

		expect(res.status).toBe(401);
	});
});

describe('POST /api/auth/register — input validation', () => {
	it('returns 400 when body is missing required fields', async () => {
		const res = await app.request('/api/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when email is missing', async () => {
		const res = await app.request('/api/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: 'password123', displayName: 'Test' }),
		});
		expect(res.status).toBe(400);
	});
});

describe('POST /api/auth/login — input validation', () => {
	it('returns 400 when body is missing required fields', async () => {
		const res = await app.request('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when password is missing', async () => {
		const res = await app.request('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com' }),
		});
		expect(res.status).toBe(400);
	});
});

describe('POST /api/auth/logout', () => {
	it('clears the auth_token cookie', async () => {
		const res = await app.request('/api/auth/logout', { method: 'POST' });

		expect(res.status).toBe(200);
		const setCookie = res.headers.get('set-cookie');
		expect(setCookie).toBeTruthy();
		expect(setCookie).toContain('auth_token=');
		// Cookie should be expired or max-age=0
		const isCleared =
			setCookie?.includes('Max-Age=0') ||
			setCookie?.includes('max-age=0') ||
			setCookie?.includes('Expires=Thu, 01 Jan 1970');
		expect(isCleared).toBe(true);
	});
});

describe('GET /api/auth/me', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	it('returns profile when cookie is valid', async () => {
		const token = await makeToken();
		const res = await app.request('/api/auth/me', {
			headers: { Cookie: `auth_token=${token}` },
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.email).toBe('admin@test.com');
		expect(body.displayName).toBe('Test Admin');
		expect(Array.isArray(body.roles)).toBe(true);
	});

	it('returns 401 when no cookie is present', async () => {
		const res = await app.request('/api/auth/me');

		expect(res.status).toBe(401);
	});

	it('returns 401 for a malformed token', async () => {
		const res = await app.request('/api/auth/me', {
			headers: { Cookie: 'auth_token=not.a.valid.jwt' },
		});

		expect(res.status).toBe(401);
	});

	it('returns 401 for an expired token', async () => {
		const token = await makeToken({ exp: Math.floor(Date.now() / 1000) - 1 });
		const res = await app.request('/api/auth/me', {
			headers: { Cookie: `auth_token=${token}` },
		});

		expect(res.status).toBe(401);
	});
});

describe('Authenticated routes — cookie-based access', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	it('allows access to protected route with valid cookie', async () => {
		const token = await makeToken({ roles: ['user'] });
		// Use /api/auth/me as a representative protected route
		const res = await app.request('/api/auth/me', {
			headers: { Cookie: `auth_token=${token}` },
		});

		expect(res.status).toBe(200);
	});

	it('denies access to protected route with no cookie', async () => {
		const res = await app.request('/api/auth/me');

		expect(res.status).toBe(401);
	});
});

describe('POST /api/auth/register — admin bootstrap', () => {
	beforeEach(async () => {
		clearRateLimitStore();
		await cleanDatabase();
	});

	afterEach(async () => {
		await cleanDatabase();
	});

	async function registerAndGetRoles(email: string): Promise<string[]> {
		const res = await app.request('/api/auth/register', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password: 'password123', displayName: 'Test' }),
		});
		expect(res.status).toBe(200);
		const cookie = res.headers.get('set-cookie')?.match(/auth_token=([^;]+)/)?.[1];
		const meRes = await app.request('/api/auth/me', {
			headers: { Cookie: `auth_token=${cookie}` },
		});
		const body = await meRes.json() as { roles: string[] };
		return body.roles;
	}

	it('first ever registrant gets admin role', async () => {
		const roles = await registerAndGetRoles('first@test.com');
		expect(roles).toContain('admin');
	});

	it('second registrant does not get admin role', async () => {
		await registerAndGetRoles('first@test.com');
		const roles = await registerAndGetRoles('second@test.com');
		expect(roles).not.toContain('admin');
	});

	it('does not grant admin when deleted_users is non-empty and active users table is empty', async () => {
		await testDb.execute(sql`
			INSERT INTO "user"."deleted_users" (user_id, email, display_name, roles, created_at)
			VALUES (999, 'deleted@test.com', 'Deleted', ARRAY['admin', 'user']::text[], NOW())
		`);
		const roles = await registerAndGetRoles('newcomer@test.com');
		expect(roles).not.toContain('admin');
	});
});

describe('DELETE /api/auth/deleteUser', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	afterEach(async () => {
		clearRateLimitStore();
	});

	// Explicit IDs: seedTestData inserts user_ids 1 and 2 without advancing the serial sequence.
	async function createUser(userId: number, email: string) {
		await testDb.execute(sql`
			INSERT INTO "user"."users" (user_id, email, display_name, password_hash, roles)
			VALUES (${userId}, ${email}, ${email}, 'x', ARRAY['user']::text[])
		`);
		return userId;
	}

	async function createLeagueWithMembers(leagueId: number, createdBy: number, members: [number, string][]) {
		await testDb.execute(sql`
			INSERT INTO leagues (league_id, name, invite_code, created_by)
			VALUES (${leagueId}, ${'League ' + leagueId}, ${'invite' + leagueId}, ${createdBy})
		`);
		for (const [userId, role] of members) {
			await testDb.execute(sql`
				INSERT INTO league_members (league_id, user_id, role) VALUES (${leagueId}, ${userId}, ${role})
			`);
		}
	}

	function deleteAs(userId: number) {
		return makeToken({ sub: userId, roles: ['user'] }).then(token =>
			app.request('/api/auth/deleteUser', { method: 'DELETE', headers: { Cookie: `auth_token=${token}` } }),
		);
	}

	it('returns 401 when unauthenticated', async () => {
		const res = await app.request('/api/auth/deleteUser', { method: 'DELETE' });
		expect(res.status).toBe(401);
	});

	it('returns 409 when the user is the sole admin of a league, and deletes nothing', async () => {
		const userId = await createUser(201, 'sole-admin@test.com');
		await createLeagueWithMembers(101, userId, [[userId, 'admin']]);

		const res = await deleteAs(userId);
		expect(res.status).toBe(409);

		const users = await testDb.execute(sql`SELECT 1 FROM "user".users WHERE user_id = ${userId}`);
		expect(users.rows).toHaveLength(1);
		const members = await testDb.execute(sql`SELECT 1 FROM league_members WHERE user_id = ${userId}`);
		expect(members.rows).toHaveLength(1);
	});

	it('deletes a plain league member along with their membership', async () => {
		const adminId = await createUser(202, 'league-admin-a@test.com');
		const memberId = await createUser(203, 'plain-member@test.com');
		await createLeagueWithMembers(102, adminId, [[adminId, 'admin'], [memberId, 'member']]);

		const res = await deleteAs(memberId);
		expect(res.status).toBe(200);

		const users = await testDb.execute(sql`SELECT 1 FROM "user".users WHERE user_id = ${memberId}`);
		expect(users.rows).toHaveLength(0);
		const members = await testDb.execute(sql`SELECT 1 FROM league_members WHERE user_id = ${memberId}`);
		expect(members.rows).toHaveLength(0);
		const audit = await testDb.execute(sql`SELECT 1 FROM "user".deleted_users WHERE user_id = ${memberId}`);
		expect(audit.rows).toHaveLength(1);
	});

	it('deletes a league creator who is not the sole admin, keeping the league with created_by cleared', async () => {
		const creatorId = await createUser(204, 'creator@test.com');
		const otherAdminId = await createUser(205, 'other-admin@test.com');
		await createLeagueWithMembers(103, creatorId, [[creatorId, 'admin'], [otherAdminId, 'admin']]);

		const res = await deleteAs(creatorId);
		expect(res.status).toBe(200);

		const league = await testDb.execute(sql`SELECT created_by FROM leagues WHERE league_id = 103`);
		expect(league.rows).toHaveLength(1);
		expect(league.rows[0].created_by).toBeNull();
		const members = await testDb.execute(sql`SELECT user_id FROM league_members WHERE league_id = 103`);
		expect(members.rows.map(r => Number(r.user_id))).toEqual([otherAdminId]);
	});
});
