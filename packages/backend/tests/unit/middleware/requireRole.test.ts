import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../../../src/utils/middleware.js';
import { err } from '../../../src/utils/response.js';
import type { Context, Next } from 'hono';

describe('requireRole middleware', () => {
	it('should allow access when user has required role', async () => {
		const mockContext = {
			get: vi.fn().mockReturnValue({
				sub: '1',
				roles: ['admin', 'user'],
				email: 'test@example.com',
			}),
			json: vi.fn(),
		} as unknown as Context;

		const mockNext = vi.fn();

		const middleware = requireRole('admin');
		await middleware(mockContext, mockNext as Next);

		expect(mockNext).toHaveBeenCalled();
		expect(mockContext.json).not.toHaveBeenCalled();
	});

	it('should deny access when user lacks required role', async () => {
		const mockContext = {
			get: vi.fn().mockReturnValue({
				sub: '1',
				roles: ['user'],
				email: 'test@example.com',
			}),
			json: vi.fn().mockReturnValue({ ok: false, error: 'Forbidden', code: 403 }),
		} as unknown as Context;

		const mockNext = vi.fn();

		const middleware = requireRole('admin');
		const result = await middleware(mockContext, mockNext as Next);

		expect(mockNext).not.toHaveBeenCalled();
		expect(mockContext.json).toHaveBeenCalledWith(err('Forbidden', 403));
	});

	it('should deny access when JWT payload is missing', async () => {
		const mockContext = {
			get: vi.fn().mockReturnValue(null),
			json: vi.fn().mockReturnValue({ ok: false, error: 'Forbidden', code: 403 }),
		} as unknown as Context;

		const mockNext = vi.fn();

		const middleware = requireRole('user');
		const result = await middleware(mockContext, mockNext as Next);

		expect(mockNext).not.toHaveBeenCalled();
		expect(mockContext.json).toHaveBeenCalledWith(err('Forbidden', 403));
	});

	it('should allow access when user has multiple roles including required', async () => {
		const mockContext = {
			get: vi.fn().mockReturnValue({
				sub: '1',
				roles: ['user', 'admin', 'moderator'],
				email: 'test@example.com',
			}),
			json: vi.fn(),
		} as unknown as Context;

		const mockNext = vi.fn();

		const middleware = requireRole('user');
		await middleware(mockContext, mockNext as Next);

		expect(mockNext).toHaveBeenCalled();
		expect(mockContext.json).not.toHaveBeenCalled();
	});
});
