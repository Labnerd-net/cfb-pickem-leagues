import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData, cleanDatabase } from '../db-utils.js';

vi.mock('../../src/notifications/emailSender.js', () => ({
	sendEmail: vi.fn().mockResolvedValue(true),
}));

import userRoutes from '../../src/routes/user.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/user', userRoutes);
app.onError((err, c) => {
	if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
	return c.json({ error: 'An unexpected error occurred' }, 500);
});

async function makeToken(userId = 1) {
	return sign(
		{
			sub: userId,
			email: 'admin@test.com',
			displayName: 'Test Admin',
			roles: ['admin', 'user'],
			exp: Math.floor(Date.now() / 1000) + 3600,
		},
		TEST_JWT_SECRET,
		'HS256',
	);
}

describe('PATCH /api/user/profile', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	afterEach(async () => {
		await cleanDatabase();
		await seedTestData();
	});

	it('returns 200 and refreshed cookie when updating display name', async () => {
		const token = await makeToken();
		const res = await app.request('/api/user/profile', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ displayName: 'New Name' }),
		});
		expect(res.status).toBe(200);
		const setCookie = res.headers.get('set-cookie');
		expect(setCookie).toBeTruthy();
		expect(setCookie).toContain('auth_token=');
		const body = await res.json() as { status: string };
		expect(body.status).toBe('updated');
	});

	it('returns 200 and refreshed cookie when changing password with correct current password', async () => {
		const token = await makeToken();
		const res = await app.request('/api/user/profile', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ currentPassword: 'password123', newPassword: 'newpassword456' }),
		});
		expect(res.status).toBe(200);
		const setCookie = res.headers.get('set-cookie');
		expect(setCookie).toBeTruthy();
		expect(setCookie).toContain('auth_token=');
	});

	it('returns 200 when updating both display name and password', async () => {
		const token = await makeToken();
		const res = await app.request('/api/user/profile', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				displayName: 'Updated Name',
				currentPassword: 'password123',
				newPassword: 'newpassword456',
			}),
		});
		expect(res.status).toBe(200);
	});

	it('returns 401 when current password is wrong', async () => {
		const token = await makeToken();
		const res = await app.request('/api/user/profile', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' }),
		});
		expect(res.status).toBe(401);
		const body = await res.json() as { error: string };
		expect(body.error).toContain('incorrect');
	});

	it('returns 400 for empty body', async () => {
		const token = await makeToken();
		const res = await app.request('/api/user/profile', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when only newPassword is provided (missing currentPassword)', async () => {
		const token = await makeToken();
		const res = await app.request('/api/user/profile', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ newPassword: 'newpassword456' }),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when only currentPassword is provided (missing newPassword)', async () => {
		const token = await makeToken();
		const res = await app.request('/api/user/profile', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ currentPassword: 'password123' }),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when displayName exceeds 50 characters', async () => {
		const token = await makeToken();
		const res = await app.request('/api/user/profile', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ displayName: 'a'.repeat(51) }),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 when newPassword is too short', async () => {
		const token = await makeToken();
		const res = await app.request('/api/user/profile', {
			method: 'PATCH',
			headers: {
				Cookie: `auth_token=${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ currentPassword: 'password123', newPassword: 'short' }),
		});
		expect(res.status).toBe(400);
	});

	it('returns 401 without auth cookie', async () => {
		const res = await app.request('/api/user/profile', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ displayName: 'New Name' }),
		});
		expect(res.status).toBe(401);
	});
});
