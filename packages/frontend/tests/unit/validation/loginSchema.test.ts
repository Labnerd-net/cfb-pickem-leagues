import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Login schema from Login.tsx
const LoginSchema = z.object({
	email: z.string().email('Please enter a valid email address'),
	password: z.string().min(6, 'Password must be at least 6 characters long'),
});

describe('Login Schema Validation', () => {
	describe('email validation', () => {
		it('should pass with valid email', () => {
			const result = LoginSchema.safeParse({
				email: 'test@example.com',
				password: 'password123',
			});

			expect(result.success).toBe(true);
		});

		it('should fail with invalid email', () => {
			const result = LoginSchema.safeParse({
				email: 'invalid-email',
				password: 'password123',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe('Please enter a valid email address');
			}
		});

		it('should fail with empty email', () => {
			const result = LoginSchema.safeParse({
				email: '',
				password: 'password123',
			});

			expect(result.success).toBe(false);
		});
	});

	describe('password validation', () => {
		it('should pass with valid password', () => {
			const result = LoginSchema.safeParse({
				email: 'test@example.com',
				password: 'password123',
			});

			expect(result.success).toBe(true);
		});

		it('should fail when password is too short', () => {
			const result = LoginSchema.safeParse({
				email: 'test@example.com',
				password: '12345',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues[0].message).toBe('Password must be at least 6 characters long');
			}
		});

		it('should fail with empty password', () => {
			const result = LoginSchema.safeParse({
				email: 'test@example.com',
				password: '',
			});

			expect(result.success).toBe(false);
		});

		it('should pass with exactly 6 characters', () => {
			const result = LoginSchema.safeParse({
				email: 'test@example.com',
				password: '123456',
			});

			expect(result.success).toBe(true);
		});
	});
});
