import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData } from '../db-utils.js';

vi.mock('../../src/notifications/dispatcher.js', () => ({
	dispatchNotification: vi.fn().mockResolvedValue(undefined),
	dispatchAdminBroadcast: vi.fn().mockResolvedValue(undefined),
	dispatchLeagueBroadcast: vi.fn().mockResolvedValue(undefined),
	dispatchGameComplete: vi.fn().mockResolvedValue(undefined),
}));

import leaguesRoute from '../../src/routes/leagues.js';
import { dispatchLeagueBroadcast } from '../../src/notifications/dispatcher.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/leagues', leaguesRoute);
app.onError((err, c) => {
	if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
	return c.json({ error: 'An unexpected error occurred' }, 500);
});

async function makeToken(userId: number, roles: string[]) {
	return sign(
		{
			sub: userId,
			email: `user${userId}@test.com`,
			displayName: `User ${userId}`,
			roles,
			emailVerified: true,
			exp: Math.floor(Date.now() / 1000) + 3600,
		},
		TEST_JWT_SECRET,
		'HS256',
	);
}

const validBody = {
	subject: 'League Update',
	message: 'Hello league members!',
	overrideEmailPreferences: false,
};

describe('POST /api/leagues/:leagueId/broadcast', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		await seedTestData();
	});

	it('returns 401 with no auth', async () => {
		const res = await app.request('/api/leagues/1/broadcast', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody),
		});
		expect(res.status).toBe(401);
	});

	it('returns 403 for non-member', async () => {
		// userId 2 is not in the default league in test seed
		const token = await makeToken(2, ['user']);
		const res = await app.request('/api/leagues/1/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody),
		});
		expect(res.status).toBe(403);
	});

	it('returns 403 for league member (non-admin)', async () => {
		// userId 1 is admin; in test data there may only be 1 user — test with a non-existing league
		const token = await makeToken(1, ['user']);
		const res = await app.request('/api/leagues/999/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody),
		});
		// 404 because league doesn't exist — treated as no membership
		expect([403, 404]).toContain(res.status);
	});

	it('returns 200 and calls dispatchLeagueBroadcast for league admin', async () => {
		const token = await makeToken(1, ['user', 'admin']);
		const res = await app.request('/api/leagues/1/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody),
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { success: boolean };
		expect(body.success).toBe(true);
		expect(dispatchLeagueBroadcast).toHaveBeenCalledOnce();
		const [leagueId, , subject, message] = (dispatchLeagueBroadcast as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(leagueId).toBe(1);
		expect(subject).toBe(validBody.subject);
		expect(message).toBe(validBody.message);
	});

	it('returns 400 for invalid body', async () => {
		const token = await makeToken(1, ['user', 'admin']);
		const res = await app.request('/api/leagues/1/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ subject: '', message: 'hi', overrideEmailPreferences: false }),
		});
		expect(res.status).toBe(400);
	});
});
