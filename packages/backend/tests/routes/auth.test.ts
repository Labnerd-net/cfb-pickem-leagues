import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData } from '../db-utils.js';
import authRoutes from '../../src/routes/auth.js';

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
