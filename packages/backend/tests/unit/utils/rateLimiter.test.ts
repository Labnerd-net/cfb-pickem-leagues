import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context, Next } from 'hono';

import { rateLimit, clearRateLimitStore } from '../../../src/utils/rateLimiter.js';

// Build a minimal Hono-like Context with configurable headers and socket address
function makeContext(opts: {
	socketAddr: string;
	xForwardedFor?: string;
	path?: string;
}): Context {
	const headers: Record<string, string> = {};
	if (opts.xForwardedFor) headers['x-forwarded-for'] = opts.xForwardedFor;

	return {
		req: {
			header: (name: string) => headers[name.toLowerCase()] ?? null,
			path: opts.path ?? '/test',
			raw: { socket: { remoteAddress: opts.socketAddr } },
		},
		header: vi.fn(),
		json: vi.fn().mockReturnValue(new Response()),
	} as unknown as Context;
}

const noopNext: Next = vi.fn().mockResolvedValue(undefined);

describe('rate limiter — TRUST_PROXY=false (default)', () => {
	afterEach(() => {
		clearRateLimitStore();
	});

	it('uses the socket address, not x-forwarded-for, as the rate-limit key', async () => {
		const middleware = rateLimit({ windowMs: 60_000, maxRequests: 2 });

		// Two requests from socket 10.0.0.1 spoofing a different IP
		await middleware(makeContext({ socketAddr: '10.0.0.1', xForwardedFor: '1.2.3.4', path: '/rl-a' }), noopNext);
		await middleware(makeContext({ socketAddr: '10.0.0.1', xForwardedFor: '1.2.3.4', path: '/rl-a' }), noopNext);

		// Third request from 10.0.0.1 should be rate limited
		const ctx = makeContext({ socketAddr: '10.0.0.1', xForwardedFor: '1.2.3.4', path: '/rl-a' });
		await middleware(ctx, noopNext);
		expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }), 429);
	});

	it('does not rate-limit a different socket address even with the same x-forwarded-for', async () => {
		const middleware = rateLimit({ windowMs: 60_000, maxRequests: 2 });

		// Exhaust limit for 10.0.0.1
		await middleware(makeContext({ socketAddr: '10.0.0.1', xForwardedFor: '9.9.9.9', path: '/rl-b' }), noopNext);
		await middleware(makeContext({ socketAddr: '10.0.0.1', xForwardedFor: '9.9.9.9', path: '/rl-b' }), noopNext);

		// Different socket address with same x-forwarded-for should not be limited
		const ctx = makeContext({ socketAddr: '10.0.0.2', xForwardedFor: '9.9.9.9', path: '/rl-b' });
		const next = vi.fn().mockResolvedValue(undefined);
		await middleware(ctx, next);
		expect(next).toHaveBeenCalled();
		expect(ctx.json).not.toHaveBeenCalledWith(expect.anything(), 429);
	});
});

describe('rate limiter — TRUST_PROXY=true', () => {
	let proxyRateLimit: typeof import('../../../src/utils/rateLimiter.js').rateLimit;
	let proxyRateLimitClear: typeof import('../../../src/utils/rateLimiter.js').clearRateLimitStore;

	beforeEach(async () => {
		vi.resetModules();
		vi.doMock('../../../src/utils/envVars.js', () => ({ trustProxy: true }));
		const mod = await import('../../../src/utils/rateLimiter.js') as typeof import('../../../src/utils/rateLimiter.js');
		proxyRateLimit = mod.rateLimit;
		proxyRateLimitClear = mod.clearRateLimitStore;
	});

	afterEach(() => {
		proxyRateLimitClear?.();
	});

	it('uses x-forwarded-for as the rate-limit key', async () => {
		const middleware = proxyRateLimit({ windowMs: 60_000, maxRequests: 2 });

		// Two requests from different sockets but same x-forwarded-for
		await middleware(makeContext({ socketAddr: '10.0.0.1', xForwardedFor: '5.5.5.5', path: '/rl-c' }), noopNext);
		await middleware(makeContext({ socketAddr: '10.0.0.2', xForwardedFor: '5.5.5.5', path: '/rl-c' }), noopNext);

		// Third request sharing the same x-forwarded-for should be rate limited
		const ctx = makeContext({ socketAddr: '10.0.0.3', xForwardedFor: '5.5.5.5', path: '/rl-c' });
		await middleware(ctx, noopNext);
		expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }), 429);
	});

	it('uses only the first IP from a comma-separated x-forwarded-for', async () => {
		const middleware = proxyRateLimit({ windowMs: 60_000, maxRequests: 2 });
		const xff = '6.6.6.6, 10.0.0.1, 172.16.0.1';

		await middleware(makeContext({ socketAddr: '10.0.0.1', xForwardedFor: xff, path: '/rl-d' }), noopNext);
		await middleware(makeContext({ socketAddr: '10.0.0.1', xForwardedFor: xff, path: '/rl-d' }), noopNext);

		// Third should be limited (keyed to 6.6.6.6 from the xff header)
		const ctx = makeContext({ socketAddr: '10.0.0.1', xForwardedFor: xff, path: '/rl-d' });
		await middleware(ctx, noopNext);
		expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }), 429);
	});
});

describe('rate limiter — general behavior', () => {
	afterEach(() => {
		clearRateLimitStore();
	});

	it('allows requests up to maxRequests and blocks the next', async () => {
		const middleware = rateLimit({ windowMs: 60_000, maxRequests: 3 });
		const next = vi.fn().mockResolvedValue(undefined);

		for (let i = 0; i < 3; i++) {
			await middleware(makeContext({ socketAddr: '192.168.1.1', path: '/rl-e' }), next);
		}
		expect(next).toHaveBeenCalledTimes(3);

		const ctx = makeContext({ socketAddr: '192.168.1.1', path: '/rl-e' });
		await middleware(ctx, next);
		expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false }), 429);
		expect(next).toHaveBeenCalledTimes(3); // no additional call
	});

	it('sets rate limit headers on allowed requests', async () => {
		const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
		const ctx = makeContext({ socketAddr: '192.168.1.2', path: '/rl-f' });
		await middleware(ctx, noopNext);
		expect(ctx.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
		expect(ctx.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
	});

	it('falls back to "unknown" when no socket address is available', async () => {
		const middleware = rateLimit({ windowMs: 60_000, maxRequests: 2 });
		const ctx = {
			req: {
				header: () => null,
				path: '/rl-g',
				raw: { socket: null },
			},
			header: vi.fn(),
			json: vi.fn().mockReturnValue(new Response()),
		} as unknown as Context;

		const next = vi.fn().mockResolvedValue(undefined);
		await middleware(ctx, next);
		expect(next).toHaveBeenCalled(); // should not crash
	});

	it('clearRateLimitStore calls clearInterval to stop the cleanup timer', () => {
		const spy = vi.spyOn(globalThis, 'clearInterval');
		clearRateLimitStore();
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});
