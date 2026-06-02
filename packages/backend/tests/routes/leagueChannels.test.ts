import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData } from '../db-utils.js';

import leaguesRoute from '../../src/routes/leagues.js';

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

describe('GET /api/leagues/:leagueId/channels', () => {
	beforeEach(async () => {
		await seedTestData();
	});

	it('returns 401 with no auth', async () => {
		const res = await app.request('/api/leagues/1/channels');
		expect(res.status).toBe(401);
	});

	it('returns 403 for non-member', async () => {
		const token = await makeToken(2, ['user']);
		const res = await app.request('/api/leagues/1/channels', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(403);
	});

	it('returns channel config (all null) for league admin with no channels set', async () => {
		const token = await makeToken(1, ['user', 'admin']);
		const res = await app.request('/api/leagues/1/channels', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json() as Record<string, unknown>;
		expect(body.ntfyTopicUrl).toBeNull();
		expect(body.discordWebhookUrl).toBeNull();
		expect(body.telegramBotToken).toBeNull();
	});
});

describe('PATCH /api/leagues/:leagueId/channels', () => {
	beforeEach(async () => {
		await seedTestData();
	});

	it('returns 401 with no auth', async () => {
		const res = await app.request('/api/leagues/1/channels', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ntfyTopicUrl: 'https://ntfy.sh/test' }),
		});
		expect(res.status).toBe(401);
	});

	it('returns 403 for non-member', async () => {
		const token = await makeToken(2, ['user']);
		const res = await app.request('/api/leagues/1/channels', {
			method: 'PATCH',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ntfyTopicUrl: 'https://ntfy.sh/test' }),
		});
		expect(res.status).toBe(403);
	});

	it('saves and returns updated channel config', async () => {
		const token = await makeToken(1, ['user', 'admin']);
		const patchRes = await app.request('/api/leagues/1/channels', {
			method: 'PATCH',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ntfyTopicUrl: 'https://ntfy.sh/mytest', discordWebhookUrl: null }),
		});
		expect(patchRes.status).toBe(200);
		const body = await patchRes.json() as Record<string, unknown>;
		expect(body.ntfyTopicUrl).toBe('https://ntfy.sh/mytest');

		// Verify GET returns updated value
		const getRes = await app.request('/api/leagues/1/channels', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(getRes.status).toBe(200);
		const getBody = await getRes.json() as Record<string, unknown>;
		expect(getBody.ntfyTopicUrl).toBe('https://ntfy.sh/mytest');
	});
});
