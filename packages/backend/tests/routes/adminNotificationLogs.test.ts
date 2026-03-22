import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData, createTestNotificationLog } from '../db-utils.js';
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

describe('GET /api/admin/notification-logs', () => {
	beforeAll(async () => {
		await seedTestData();
		// Insert a broadcast log entry (userId=0)
		await createTestNotificationLog(0, 2024, 1, 'games_ready', 'ntfy');
		// Insert a real user log entry (userId=1, admin user)
		await createTestNotificationLog(1, 2024, 1, 'games_ready', 'email');
	});

	it('should return 401 with no auth token', async () => {
		const res = await app.request('/api/admin/notification-logs');
		expect(res.status).toBe(401);
	});

	it('should return 403 for non-admin user', async () => {
		const token = await makeToken(['user'], 2);
		const res = await app.request('/api/admin/notification-logs', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(403);
		const body = await res.json() as { error: string };
		expect(body.error).toBe('Forbidden');
	});

	it('should return 200 with entries array and total for admin', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { entries: unknown[]; total: number };
		expect(Array.isArray(body.entries)).toBe(true);
		expect(typeof body.total).toBe('number');
		expect(body.entries.length).toBeGreaterThan(0);
	});

	it('each entry has required fields', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs', {
			headers: { Cookie: `auth_token=${token}` },
		});
		const body = await res.json() as { entries: Record<string, unknown>[]; total: number };
		for (const entry of body.entries) {
			expect(entry).toHaveProperty('id');
			expect(entry).toHaveProperty('sentAt');
			expect(entry).toHaveProperty('notificationType');
			expect(entry).toHaveProperty('channel');
			expect(entry).toHaveProperty('year');
			expect(entry).toHaveProperty('weekNumber');
			expect(entry).toHaveProperty('recipient');
		}
	});

	it('broadcast entry (userId=0) has recipient "Broadcast"', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs', {
			headers: { Cookie: `auth_token=${token}` },
		});
		const body = await res.json() as { entries: { userId: number; recipient: string }[]; total: number };
		const broadcast = body.entries.find(e => e.userId === 0);
		expect(broadcast).toBeDefined();
		expect(broadcast?.recipient).toBe('Broadcast');
	});

	it('real user entry has recipient equal to user displayName', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs', {
			headers: { Cookie: `auth_token=${token}` },
		});
		const body = await res.json() as { entries: { userId: number; recipient: string }[]; total: number };
		const userEntry = body.entries.find(e => e.userId === 1);
		expect(userEntry).toBeDefined();
		expect(userEntry?.recipient).toBe('Test Admin');
	});

	it('respects limit param', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs?limit=1', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { entries: unknown[]; total: number };
		expect(body.entries.length).toBe(1);
		expect(body.total).toBeGreaterThan(0);
	});

	it('returns empty entries when offset exceeds total', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs?limit=50&offset=9999', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { entries: unknown[]; total: number };
		expect(body.entries.length).toBe(0);
		expect(body.total).toBeGreaterThan(0);
	});

	it('uses default limit of 50 when no params provided', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
	});

	it('returns 400 for invalid limit param', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs?limit=abc', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(400);
	});

	it('filters by channel and total reflects filtered count', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs?channel=email', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { entries: { channel: string }[]; total: number };
		expect(body.entries.every(e => e.channel === 'email')).toBe(true);
		expect(body.total).toBe(body.entries.length);
	});

	it('filters by notificationType and total reflects filtered count', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs?notificationType=games_ready', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { entries: { notificationType: string }[]; total: number };
		expect(body.entries.every(e => e.notificationType === 'games_ready')).toBe(true);
		expect(body.total).toBe(body.entries.length);
	});

	it('ANDs channel and notificationType filters', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs?channel=email&notificationType=games_ready', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { entries: { channel: string; notificationType: string }[]; total: number };
		expect(body.entries.every(e => e.channel === 'email' && e.notificationType === 'games_ready')).toBe(true);
		expect(body.total).toBe(body.entries.length);
	});

	it('returns 400 for invalid channel param', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs?channel=invalid', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 for invalid notificationType param', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notification-logs?notificationType=invalid', {
			headers: { Cookie: `auth_token=${token}` },
		});
		expect(res.status).toBe(400);
	});
});
