import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Registration schema from Registration.tsx
const RegistrationSchema = z
	.object({
		email: z.string().email('Please enter a valid email address'),
		displayName: z
			.string()
			.min(1, 'Display name is required')
			.max(50, 'Display name must be less than 50 characters'),
		password: z.string().min(6, 'Password must be at least 6 characters long'),
		confirmPassword: z.string().min(6, 'Password must be at least 6 characters long'),
	})
	.refine((data) => data.password === data.confirmPassword, {
		path: ['confirmPassword'],
		message: 'Passwords do not match',
	});

describe('Registration Schema Validation', () => {
	describe('email validation', () => {
		it('should pass with valid email', () => {
			const result = RegistrationSchema.safeParse({
				email: 'test@example.com',
				displayName: 'Test User',
				password: 'password123',
				confirmPassword: 'password123',
			});

			expect(result.success).toBe(true);
		});

		it('should fail with invalid email', () => {
			const result = RegistrationSchema.safeParse({
				email: 'invalid-email',
				displayName: 'Test User',
				password: 'password123',
				confirmPassword: 'password123',
			});

			expect(result.success).toBe(false);
		});
	});

	describe('displayName validation', () => {
		it('should pass with valid display name', () => {
			const result = RegistrationSchema.safeParse({
				email: 'test@example.com',
				displayName: 'John Doe',
				password: 'password123',
				confirmPassword: 'password123',
			});

			expect(result.success).toBe(true);
		});

		it('should fail with empty display name', () => {
			const result = RegistrationSchema.safeParse({
				email: 'test@example.com',
				displayName: '',
				password: 'password123',
				confirmPassword: 'password123',
			});

			expect(result.success).toBe(false);
		});

		it('should fail when display name exceeds 50 characters', () => {
			const result = RegistrationSchema.safeParse({
				email: 'test@example.com',
				displayName: 'A'.repeat(51),
				password: 'password123',
				confirmPassword: 'password123',
			});

			expect(result.success).toBe(false);
		});

		it('should pass with display name at max length', () => {
			const result = RegistrationSchema.safeParse({
				email: 'test@example.com',
				displayName: 'A'.repeat(50),
				password: 'password123',
				confirmPassword: 'password123',
			});

			expect(result.success).toBe(true);
		});
	});

	describe('password validation', () => {
		it('should pass with valid password', () => {
			const result = RegistrationSchema.safeParse({
				email: 'test@example.com',
				displayName: 'Test User',
				password: 'password123',
				confirmPassword: 'password123',
			});

			expect(result.success).toBe(true);
		});

		it('should fail when password is too short', () => {
			const result = RegistrationSchema.safeParse({
				email: 'test@example.com',
				displayName: 'Test User',
				password: '12345',
				confirmPassword: '12345',
			});

			expect(result.success).toBe(false);
		});
	});

	describe('password matching validation', () => {
		it('should fail when passwords do not match', () => {
			const result = RegistrationSchema.safeParse({
				email: 'test@example.com',
				displayName: 'Test User',
				password: 'password123',
				confirmPassword: 'password456',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				const confirmPasswordError = result.error.issues.find(
					(issue) => issue.path[0] === 'confirmPassword',
				);
				expect(confirmPasswordError?.message).toBe('Passwords do not match');
			}
		});

		it('should pass when passwords match', () => {
			const result = RegistrationSchema.safeParse({
				email: 'test@example.com',
				displayName: 'Test User',
				password: 'password123',
				confirmPassword: 'password123',
			});

			expect(result.success).toBe(true);
		});
	});
});
