import { describe, it, expect } from 'vitest';
import {
	demoBlockReason,
	DEMO_ADMIN_ALLOWED,
	DEMO_ADMIN_BLOCKED,
} from '../../../src/utils/demoGuard.js';
import { app } from '../../../src/index.js';

describe('demoBlockReason — admin routes are deny by default', () => {
	it.each([
		['GET', '/api/admin/users'],
		['GET', '/api/admin/weeks'],
		['GET', '/api/admin/games'],
		['PATCH', '/api/admin/games/42/score'],
		['GET', '/api/admin/notification-logs'],
		['GET', '/api/admin/leagues/1/games'],
		['POST', '/api/admin/leagues/1/games/42'],
		['DELETE', '/api/admin/leagues/1/games/42'],
	])('allows %s %s', (method, path) => {
		expect(demoBlockReason(method, path)).toBeNull();
	});

	it.each([
		['PATCH', '/api/admin/users/3/roles'],
		['PATCH', '/api/admin/users/3/password'],
		['POST', '/api/admin/year/2024'],
		['DELETE', '/api/admin/year/2024'],
		['POST', '/api/admin/week'],
		['POST', '/api/admin/weeks/sync-results'],
		['POST', '/api/admin/notifications/test'],
		['GET', '/api/admin/users/export'],
		['POST', '/api/admin/notifications/broadcast'],
		// Unknown / future admin routes are blocked until classified.
		['GET', '/api/admin/something-new'],
		['POST', '/api/admin/users'],
		['DELETE', '/api/admin/users'],
		['PUT', '/api/admin/games'],
	])('blocks %s %s', (method, path) => {
		expect(demoBlockReason(method, path)).toMatch(/disabled in the demo/);
	});

	it('does not let a trailing slash bypass the allowlist or the blocklist', () => {
		expect(demoBlockReason('GET', '/api/admin/users/')).toBeNull();
		expect(demoBlockReason('GET', '/api/admin/users/export/')).not.toBeNull();
	});

	it('classifies HEAD like GET', () => {
		expect(demoBlockReason('HEAD', '/api/admin/users')).toBeNull();
		expect(demoBlockReason('HEAD', '/api/admin/users/export')).not.toBeNull();
	});
});

describe('demoBlockReason — non-admin routes', () => {
	it.each([
		['POST', '/api/auth/register'],
		['POST', '/api/auth/resend-verification'],
		['DELETE', '/api/auth/deleteUser'],
		['PATCH', '/api/user/profile'],
		['DELETE', '/api/leagues/1'],
		['PATCH', '/api/leagues/1/channels'],
		['POST', '/api/leagues/1/broadcast'],
	])('blocks %s %s', (method, path) => {
		expect(demoBlockReason(method, path)).toMatch(/disabled in the demo/);
	});

	it.each([
		['POST', '/api/auth/demo-login'],
		['POST', '/api/auth/login'],
		['POST', '/api/auth/logout'],
		['GET', '/api/auth/me'],
		['POST', '/api/user/picks'],
		['GET', '/api/user/picks'],
		['PATCH', '/api/user/notifications/preferences'],
		['POST', '/api/leagues'],
		['POST', '/api/leagues/join'],
		['PATCH', '/api/leagues/1'],
		['POST', '/api/leagues/1/invite/regenerate'],
		['GET', '/api/leagues/1/channels'],
		['GET', '/api/leaderboard'],
	])('allows %s %s', (method, path) => {
		expect(demoBlockReason(method, path)).toBeNull();
	});

	it('blocks changing or removing the two shared demo accounts', () => {
		for (const id of [1, 2]) {
			expect(demoBlockReason('PATCH', `/api/leagues/1/members/${id}`)).toMatch(/shared demo accounts/);
			expect(demoBlockReason('DELETE', `/api/leagues/1/members/${id}`)).toMatch(/shared demo accounts/);
		}
	});

	it('allows changing or removing other members', () => {
		expect(demoBlockReason('PATCH', '/api/leagues/1/members/3')).toBeNull();
		expect(demoBlockReason('DELETE', '/api/leagues/1/members/57')).toBeNull();
		expect(demoBlockReason('GET', '/api/leagues/1/members')).toBeNull();
	});
});

describe('admin route classification', () => {
	const key = (r: { method: string; path: string }) => `${r.method} ${r.path}`;
	const classified = new Set([...DEMO_ADMIN_ALLOWED, ...DEMO_ADMIN_BLOCKED].map(key));

	// Hono lists middleware as method ALL; only concrete handlers are routes.
	const registered = app.routes
		.filter(r => r.method !== 'ALL' && r.path.startsWith('/api/admin'))
		.map(key);

	it('finds the registered admin routes', () => {
		expect(registered.length).toBeGreaterThan(10);
	});

	it('every registered /api/admin route is classified as allowed or blocked', () => {
		const unclassified = [...new Set(registered)].filter(r => !classified.has(r));
		expect(unclassified, `Classify these in utils/demoGuard.ts: ${unclassified.join(', ')}`).toEqual([]);
	});

	it('no route is both allowed and blocked', () => {
		const allowed = new Set(DEMO_ADMIN_ALLOWED.map(key));
		expect(DEMO_ADMIN_BLOCKED.filter(r => allowed.has(key(r)))).toEqual([]);
	});

	it('every classified route still exists (no stale entries)', () => {
		const live = new Set(registered);
		expect([...classified].filter(r => !live.has(r))).toEqual([]);
	});

	it('the guard agrees with the lists for every registered route', () => {
		const allowed = new Set(DEMO_ADMIN_ALLOWED.map(key));
		for (const r of new Set(registered)) {
			const [method, path] = r.split(' ');
			const concrete = path.replace(/:[A-Za-z]+/g, '7');
			expect(demoBlockReason(method, concrete) === null, r).toBe(allowed.has(r));
		}
	});
});
