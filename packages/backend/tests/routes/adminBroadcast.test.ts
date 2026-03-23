import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData } from '../db-utils.js';

// Mock dispatcher so no real notifications are sent
vi.mock('../../src/notifications/dispatcher.js', () => ({
	dispatchNotification: vi.fn().mockResolvedValue(undefined),
	dispatchAdminBroadcast: vi.fn().mockResolvedValue(undefined),
}));

import adminRoutes from '../../src/routes/admin.js';
import { dispatchAdminBroadcast } from '../../src/notifications/dispatcher.js';

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

const validBody = {
	subject: 'Test Subject',
	message: 'Test message body.',
	overrideEmailPreferences: false,
};

describe('POST /api/admin/notifications/broadcast', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	it('returns 401 with no auth', async () => {
		const res = await app.request('/api/admin/notifications/broadcast', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody),
		});
		expect(res.status).toBe(401);
	});

	it('returns 403 for non-admin user', async () => {
		const token = await makeToken(['user'], 2);
		const res = await app.request('/api/admin/notifications/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody),
		});
		expect(res.status).toBe(403);
	});

	it('returns 400 for empty subject', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notifications/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...validBody, subject: '' }),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 for empty message', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notifications/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...validBody, message: '' }),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 for subject over 100 characters', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notifications/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...validBody, subject: 'a'.repeat(101) }),
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 for message over 1000 characters', async () => {
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notifications/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...validBody, message: 'a'.repeat(1001) }),
		});
		expect(res.status).toBe(400);
	});

	it('returns 200 and calls dispatchAdminBroadcast with correct args', async () => {
		vi.clearAllMocks();
		const token = await makeToken(['admin', 'user'], 1);
		const res = await app.request('/api/admin/notifications/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(validBody),
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { success: boolean };
		expect(body.success).toBe(true);
		expect(dispatchAdminBroadcast).toHaveBeenCalledOnce();
		const [subject, message, override] = (dispatchAdminBroadcast as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(subject).toBe(validBody.subject);
		expect(message).toBe(validBody.message);
		expect(override).toBe(false);
	});

	it('passes overrideEmailPreferences=true when set', async () => {
		vi.clearAllMocks();
		const token = await makeToken(['admin', 'user'], 1);
		await app.request('/api/admin/notifications/broadcast', {
			method: 'POST',
			headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...validBody, overrideEmailPreferences: true }),
		});
		const [, , override] = (dispatchAdminBroadcast as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(override).toBe(true);
	});
});
