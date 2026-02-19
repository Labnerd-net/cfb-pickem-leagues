import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server.js';
import { getUsers } from '../../../src/apis/adminRequests.js';

describe('Admin API Requests', () => {
	beforeEach(() => {
		vi.mocked(localStorage.getItem).mockReturnValue('mock-jwt-token');
	});

	describe('getUsers', () => {
		it('should return success response with user list', async () => {
			const result = await getUsers();

			expect(result.success).toBe(true);
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data?.length).toBeGreaterThan(0);
			expect(result.data?.[0].email).toBe('test@example.com');
			expect(result.data?.[0].displayName).toBe('Test User');
		});

		it('should return failure when backend returns ok: false', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/users', () => {
					return HttpResponse.json({
						ok: false,
						error: 'Forbidden',
						code: 403,
					});
				}),
			);

			const result = await getUsers();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Forbidden');
		});

		it('should handle network errors', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/users', () => {
					return HttpResponse.error();
				}),
			);

			const result = await getUsers();

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});
});
