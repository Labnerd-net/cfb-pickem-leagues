import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData } from '../db-utils.js';
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
