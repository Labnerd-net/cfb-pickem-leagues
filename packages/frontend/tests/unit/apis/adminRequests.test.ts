import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server.js';
import { getUsers, getNotificationLogs } from '../../../src/apis/adminRequests.js';

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

		it('should return failure when backend returns an error status', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/users', () => {
					return HttpResponse.json(
						{ error: 'Forbidden' },
						{ status: 403 },
					);
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

	describe('getNotificationLogs', () => {
		it('should return success response with entries and total', async () => {
			const result = await getNotificationLogs();

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data?.entries)).toBe(true);
			expect(typeof result.data?.total).toBe('number');
			expect(result.data?.entries[0].recipient).toBe('Broadcast');
		});

		it('should return failure when backend returns 403', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/notification-logs', () => {
					return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
				}),
			);

			const result = await getNotificationLogs();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Forbidden');
		});

		it('should handle network errors', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/notification-logs', () => {
					return HttpResponse.error();
				}),
			);

			const result = await getNotificationLogs();

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});
});
