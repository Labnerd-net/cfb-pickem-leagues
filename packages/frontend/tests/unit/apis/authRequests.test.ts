import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server.js';
import { loginUser, registerUser, deleteUser } from '../../../src/apis/authRequests.js';

describe('Auth API Requests', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		vi.mocked(localStorage.getItem).mockReturnValue(null);
		vi.mocked(localStorage.setItem).mockClear();
		vi.mocked(localStorage.removeItem).mockClear();
	});

	describe('loginUser', () => {
		it('should return success response with token and user data', async () => {
			const credentials = {
				email: 'test@example.com',
				password: 'password123',
			};

			const result = await loginUser(credentials);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data?.token).toBe('mock-jwt-token');
		});

		it('should handle login failure', async () => {
			server.use(
				http.post('http://localhost:3000/api/auth/login', () => {
					return HttpResponse.json(
						{
							ok: false,
							error: 'Invalid credentials',
							code: 401,
						},
						{ status: 401 },
					);
				}),
			);

			const credentials = {
				email: 'wrong@example.com',
				password: 'wrongpassword',
			};

			const result = await loginUser(credentials);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid credentials');
		});

		it('should handle network errors', async () => {
			server.use(
				http.post('http://localhost:3000/api/auth/login', () => {
					return HttpResponse.error();
				}),
			);

			const credentials = {
				email: 'test@example.com',
				password: 'password123',
			};

			const result = await loginUser(credentials);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe('registerUser', () => {
		it('should return success response with token and user data', async () => {
			const userData = {
				email: 'newuser@example.com',
				password: 'password123',
				displayName: 'New User',
			};

			const result = await registerUser(userData);

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data?.token).toBe('mock-jwt-token');
		});

		it('should handle duplicate email error', async () => {
			server.use(
				http.post('http://localhost:3000/api/auth/register', () => {
					return HttpResponse.json(
						{
							ok: false,
							error: 'Email already exists',
							code: 400,
						},
						{ status: 400 },
					);
				}),
			);

			const userData = {
				email: 'existing@example.com',
				password: 'password123',
				displayName: 'Existing User',
			};

			const result = await registerUser(userData);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Email already exists');
		});
	});

	describe('deleteUser', () => {
		it('should successfully delete user when authenticated', async () => {
			vi.mocked(localStorage.getItem).mockReturnValue('mock-jwt-token');

			const result = await deleteUser();

			expect(result.success).toBe(true);
		});

		it('should handle unauthorized deletion', async () => {
			server.use(
				http.delete('http://localhost:3000/api/auth/deleteUser', () => {
					return HttpResponse.json(
						{
							ok: false,
							error: 'Unauthorized',
							code: 401,
						},
						{ status: 401 },
					);
				}),
			);

			vi.mocked(localStorage.getItem).mockReturnValue('invalid-token');

			const result = await deleteUser();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Unauthorized');
		});
	});
});
