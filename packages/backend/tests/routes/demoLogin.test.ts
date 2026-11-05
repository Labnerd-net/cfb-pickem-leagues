import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { verify } from 'hono/jwt';
import { sql } from 'drizzle-orm';
import { seedTestData, testDb } from '../db-utils.js';
import { app } from '../../src/index.js';
import { reinitializeSecrets } from '../../src/utils/envVars.js';
import { clearRateLimitStore } from '../../src/utils/rateLimiter.js';
import { DEMO_ADMIN_EMAIL, DEMO_USER_EMAIL } from '../../src/demo/seedData.js';

const SECRET = 'test-secret-key-do-not-use-in-production';
const baseEnv = { JWT_SECRET: SECRET, CFBD_API_KEY: 'test-cfbd-key' };

function setDemo(on: boolean) {
	reinitializeSecrets({ ...baseEnv, DEMO_MODE: on ? 'true' : 'false' });
}

function post(path: string, body: unknown) {
	return app.request(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

function cookieToken(res: Response): string {
	const header = res.headers.get('set-cookie') ?? '';
	return /auth_token=([^;]+)/.exec(header)?.[1] ?? '';
}

// seedTestData inserts users with explicit IDs, so pick IDs that cannot collide.
const adminId = 101;
const userId = 102;

beforeAll(async () => {
	await seedTestData();
	await testDb.execute(sql`
		INSERT INTO "user"."users" (user_id, email, display_name, password_hash, roles, email_verified)
		VALUES
			(${adminId}, ${DEMO_ADMIN_EMAIL}, 'Demo Admin', 'x', ARRAY['admin', 'user']::text[], true),
			(${userId}, ${DEMO_USER_EMAIL}, 'Demo User', 'x', ARRAY['user']::text[], true)
	`);
});

afterEach(() => {
	clearRateLimitStore();
	setDemo(false);
});

describe('POST /api/auth/demo-login', () => {
	it('is absent (404) when demo mode is off', async () => {
		setDemo(false);
		const res = await post('/api/auth/demo-login', { account: 'admin' });
		expect(res.status).toBe(404);
		expect(res.headers.get('set-cookie')).toBeNull();
	});

	it('signs in as the demo admin', async () => {
		setDemo(true);
		const res = await post('/api/auth/demo-login', { account: 'admin' });
		expect(res.status).toBe(200);
		const payload = await verify(cookieToken(res), SECRET, 'HS256');
		expect(payload.sub).toBe(adminId);
		expect(payload.email).toBe(DEMO_ADMIN_EMAIL);
		expect(payload.roles).toEqual(['admin', 'user']);
	});

	it('signs in as the demo user, without the admin role', async () => {
		setDemo(true);
		const res = await post('/api/auth/demo-login', { account: 'user' });
		expect(res.status).toBe(200);
		const payload = await verify(cookieToken(res), SECRET, 'HS256');
		expect(payload.sub).toBe(userId);
		expect(payload.roles).toEqual(['user']);
	});

	it('sets an httpOnly, Secure, SameSite=Strict cookie', async () => {
		setDemo(true);
		const res = await post('/api/auth/demo-login', { account: 'user' });
		const cookie = (res.headers.get('set-cookie') ?? '').toLowerCase();
		expect(cookie).toContain('httponly');
		expect(cookie).toContain('secure');
		expect(cookie).toContain('samesite=strict');
	});

	it.each([
		[{ account: 'superuser' }],
		[{ account: 1 }],
		[{ userId: 1 }],
		[{}],
		[{ email: 'admin@test.com', password: 'password123' }],
	])('rejects %j', async body => {
		setDemo(true);
		const res = await post('/api/auth/demo-login', body);
		expect(res.status).toBe(400);
		expect(res.headers.get('set-cookie')).toBeNull();
	});

	it('cannot be used to reach a non-demo account via extra fields', async () => {
		setDemo(true);
		const res = await post('/api/auth/demo-login', { account: 'user', userId: 1, email: 'admin@test.com' });
		expect(res.status).toBe(200);
		const payload = await verify(cookieToken(res), SECRET, 'HS256');
		expect(payload.email).toBe(DEMO_USER_EMAIL);
	});

	it('is rate limited', async () => {
		setDemo(true);
		let limited = 0;
		for (let i = 0; i < 12; i++) {
			const res = await post('/api/auth/demo-login', { account: 'user' });
			if (res.status === 429) limited++;
		}
		expect(limited).toBeGreaterThan(0);
	});
});

describe('demo guard through the full app', () => {
	it('locks registration when demo mode is on', async () => {
		setDemo(true);
		const res = await post('/api/auth/register', { email: 'new@example.com', password: 'Passw0rd!x', displayName: 'New' });
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'This action is disabled in the demo.' });
	});

	it('leaves registration alone when demo mode is off', async () => {
		setDemo(false);
		const res = await post('/api/auth/register', {});
		expect(res.status).toBe(400);
	});

	it('blocks resend-verification, account deletion, profile edits in demo mode', async () => {
		setDemo(true);
		for (const [method, path] of [
			['POST', '/api/auth/resend-verification'],
			['DELETE', '/api/auth/deleteUser'],
			['PATCH', '/api/user/profile'],
		]) {
			const res = await app.request(path, { method });
			expect(res.status, `${method} ${path}`).toBe(403);
		}
	});

	it('blocks league deletion, channel edits, and broadcasts in demo mode', async () => {
		setDemo(true);
		for (const [method, path] of [
			['DELETE', '/api/leagues/1'],
			['PATCH', '/api/leagues/1/channels'],
			['POST', '/api/leagues/1/broadcast'],
			['PATCH', '/api/leagues/1/members/1'],
			['DELETE', '/api/leagues/1/members/2'],
		]) {
			const res = await app.request(path, { method });
			expect(res.status, `${method} ${path}`).toBe(403);
		}
	});

	it('does not block the same routes when demo mode is off (they reach auth instead)', async () => {
		setDemo(false);
		for (const [method, path] of [
			['DELETE', '/api/auth/deleteUser'],
			['POST', '/api/admin/notifications/test'],
			['DELETE', '/api/leagues/1'],
		]) {
			const res = await app.request(path, { method });
			expect(res.status, `${method} ${path}`).toBe(401);
		}
	});

	it('blocks unlisted admin routes for a real admin session but still serves allowed ones', async () => {
		setDemo(true);
		const login = await post('/api/auth/demo-login', { account: 'admin' });
		const cookie = `auth_token=${cookieToken(login)}`;

		const blocked = await app.request('/api/admin/users/export', { headers: { cookie } });
		expect(blocked.status).toBe(403);

		const allowed = await app.request('/api/admin/users', { headers: { cookie } });
		expect(allowed.status).toBe(200);
	});

	it('lets a demo-user session use normal endpoints', async () => {
		setDemo(true);
		const login = await post('/api/auth/demo-login', { account: 'user' });
		const cookie = `auth_token=${cookieToken(login)}`;
		const me = await app.request('/api/auth/me', { headers: { cookie } });
		expect(me.status).toBe(200);
	});
});
