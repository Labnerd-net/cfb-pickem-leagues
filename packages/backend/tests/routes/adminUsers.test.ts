import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData, testDb } from '../db-utils.js';
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

describe('GET /api/admin/users', () => {
	beforeAll(async () => {
		await seedTestData();
	});


	it('should return all users for admin', async () => {
		const token = await makeToken(['admin', 'user']);
		const res = await app.request('/api/admin/users', {
			headers: { Cookie: `auth_token=${token}` },
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(Array.isArray(body.allUserProfiles)).toBe(true);
		expect(body.allUserProfiles.length).toBeGreaterThan(0);
	});

	it('should return 403 for non-admin user', async () => {
		const token = await makeToken(['user'], 2);
		const res = await app.request('/api/admin/users', {
			headers: { Cookie: `auth_token=${token}` },
		});

		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.error).toBe('Forbidden');
	});

	it('should return 401 with no cookie', async () => {
		const res = await app.request('/api/admin/users');

		expect(res.status).toBe(401);
	});
});

describe('PATCH /api/admin/users/:id/roles', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	// Reset user 2 back to ['user'] before each test so tests don't bleed into each other
	beforeEach(async () => {
		await testDb.execute(sql`
			UPDATE "user"."users" SET roles = ARRAY['user']::text[] WHERE user_id = 2
		`);
	});

	it('should promote a regular user to admin', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/users/2/roles', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ roles: ['user', 'admin'] }),
		});

		expect(res.status).toBe(200);
		const body = await res.json() as { user: { roles: string[] } };
		expect(body.user.roles).toContain('admin');
		expect(body.user.roles).toContain('user');
	});

	it('should demote an admin user to regular user', async () => {
		// First promote user 2
		await testDb.execute(sql`
			UPDATE "user"."users" SET roles = ARRAY['user', 'admin']::text[] WHERE user_id = 2
		`);

		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/users/2/roles', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ roles: ['user'] }),
		});

		expect(res.status).toBe(200);
		const body = await res.json() as { user: { roles: string[] } };
		expect(body.user.roles).toEqual(['user']);
		expect(body.user.roles).not.toContain('admin');
	});

	it('should return 403 when trying to modify own roles', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/users/1/roles', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ roles: ['user'] }),
		});

		expect(res.status).toBe(403);
		const body = await res.json() as { error: string };
		expect(body.error).toBe('Cannot modify your own roles');
	});

	it('should return 404 for a non-existent user', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/users/9999/roles', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ roles: ['user', 'admin'] }),
		});

		expect(res.status).toBe(404);
	});

	it('should return 400 for an invalid user id', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/users/abc/roles', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ roles: ['user'] }),
		});

		expect(res.status).toBe(400);
	});

	it('should return 400 for an empty roles array', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/users/2/roles', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ roles: [] }),
		});

		expect(res.status).toBe(400);
	});

	it('should return 400 for an invalid role value', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/users/2/roles', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ roles: ['superuser'] }),
		});

		expect(res.status).toBe(400);
	});

	it('should return 403 for a non-admin user', async () => {
		const token = await makeToken(['user'], 2);
		const res = await app.request('/api/admin/users/1/roles', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ roles: ['user'] }),
		});

		expect(res.status).toBe(403);
	});

	it('should return 401 with no cookie', async () => {
		const res = await app.request('/api/admin/users/2/roles', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ roles: ['user', 'admin'] }),
		});

		expect(res.status).toBe(401);
	});
});
