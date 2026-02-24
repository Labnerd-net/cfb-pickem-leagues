import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData, cleanDatabase } from '../db-utils.js';

// Mock the senders so no real emails/ntfy are sent
vi.mock('../../src/notifications/emailSender.js', () => ({
	sendEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../src/notifications/ntfySender.js', () => ({
	sendNtfyNotification: vi.fn().mockResolvedValue(true),
}));

import userRoutes from '../../src/routes/user.js';
import authRoutes from '../../src/routes/auth.js';
import { updateUserNtfyUrl, setEmailVerificationToken } from '../../src/db/dbNotificationFunctions.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/user', userRoutes);
app.route('/api/auth', authRoutes);
app.onError((err, c) => {
	if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
	return c.json({ error: 'An unexpected error occurred' }, 500);
});

async function makeToken(userId = 1, overrides: Record<string, unknown> = {}) {
	return sign(
		{
			sub: userId,
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

describe('Notification routes', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	afterEach(async () => {
		await cleanDatabase();
		await seedTestData();
	});

	describe('GET /api/user/notifications/preferences', () => {
		it('returns 200 with notification settings for authenticated user', async () => {
			const token = await makeToken();
			const res = await app.request('/api/user/notifications/preferences', {
				headers: { Cookie: `auth_token=${token}` },
			});
			expect(res.status).toBe(200);
			const body = await res.json() as { preferences: unknown[]; emailVerified: boolean; ntfyServerUrl: null };
			expect(body).toHaveProperty('preferences');
			expect(body).toHaveProperty('emailVerified');
			expect(body).toHaveProperty('ntfyServerUrl');
		});

		it('returns 401 without auth', async () => {
			const res = await app.request('/api/user/notifications/preferences');
			expect(res.status).toBe(401);
		});
	});

	describe('PATCH /api/user/notifications/preferences', () => {
		it('returns 200 on valid preference update', async () => {
			const token = await makeToken();
			const res = await app.request('/api/user/notifications/preferences', {
				method: 'PATCH',
				headers: {
					Cookie: `auth_token=${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ notificationType: 'games_ready', channel: 'email', enabled: false }),
			});
			expect(res.status).toBe(200);
		});

		it('returns 400 for invalid channel', async () => {
			const token = await makeToken();
			const res = await app.request('/api/user/notifications/preferences', {
				method: 'PATCH',
				headers: {
					Cookie: `auth_token=${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ notificationType: 'games_ready', channel: 'sms', enabled: true }),
			});
			expect(res.status).toBe(400);
		});

		it('returns 401 without auth', async () => {
			const res = await app.request('/api/user/notifications/preferences', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notificationType: 'games_ready', channel: 'email', enabled: false }),
			});
			expect(res.status).toBe(401);
		});
	});

	describe('PATCH /api/user/notifications/ntfy-url', () => {
		it('returns 200 on valid URL', async () => {
			const token = await makeToken();
			const res = await app.request('/api/user/notifications/ntfy-url', {
				method: 'PATCH',
				headers: {
					Cookie: `auth_token=${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ ntfyServerUrl: 'https://ntfy.sh' }),
			});
			expect(res.status).toBe(200);
		});

		it('returns 400 on invalid URL', async () => {
			const token = await makeToken();
			const res = await app.request('/api/user/notifications/ntfy-url', {
				method: 'PATCH',
				headers: {
					Cookie: `auth_token=${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ ntfyServerUrl: 'not-a-url' }),
			});
			expect(res.status).toBe(400);
		});

		it('accepts null to clear the URL', async () => {
			const token = await makeToken();
			const res = await app.request('/api/user/notifications/ntfy-url', {
				method: 'PATCH',
				headers: {
					Cookie: `auth_token=${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ ntfyServerUrl: null }),
			});
			expect(res.status).toBe(200);
		});
	});

	describe('POST /api/user/notifications/test-ntfy', () => {
		it('returns 400 when no NTFY URL is configured', async () => {
			const token = await makeToken();
			const res = await app.request('/api/user/notifications/test-ntfy', {
				method: 'POST',
				headers: { Cookie: `auth_token=${token}` },
			});
			expect(res.status).toBe(400);
		});

		it('returns 200 when NTFY URL is configured', async () => {
			await updateUserNtfyUrl(1, 'https://ntfy.sh');
			const token = await makeToken();
			const res = await app.request('/api/user/notifications/test-ntfy', {
				method: 'POST',
				headers: { Cookie: `auth_token=${token}` },
			});
			expect(res.status).toBe(200);
			const body = await res.json() as { status: string };
			expect(['sent', 'failed']).toContain(body.status);
		});
	});

	describe('GET /api/auth/verify-email', () => {
		it('returns 200 with valid token', async () => {
			const token = 'valid-test-token-xyz';
			await setEmailVerificationToken(1, token, new Date());
			const res = await app.request(`/api/auth/verify-email?token=${token}`);
			expect(res.status).toBe(200);
			const body = await res.json() as { status: string };
			expect(body.status).toBe('verified');
		});

		it('returns 400 with invalid token', async () => {
			const res = await app.request('/api/auth/verify-email?token=bad-token');
			expect(res.status).toBe(400);
		});

		it('returns 400 when token is missing', async () => {
			const res = await app.request('/api/auth/verify-email');
			expect(res.status).toBe(400);
		});
	});

	describe('POST /api/auth/resend-verification', () => {
		it('returns 200 when authenticated', async () => {
			const token = await makeToken();
			const res = await app.request('/api/auth/resend-verification', {
				method: 'POST',
				headers: { Cookie: `auth_token=${token}` },
			});
			expect(res.status).toBe(200);
		});

		it('returns 401 without auth', async () => {
			const res = await app.request('/api/auth/resend-verification', { method: 'POST' });
			expect(res.status).toBe(401);
		});
	});
});
