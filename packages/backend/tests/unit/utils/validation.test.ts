import { describe, it, expect } from 'vitest';
import { validateEmail } from '../../../src/utils/emailValidation.js';
import { validatePassword } from '../../../src/utils/passwordValidation.js';

describe('Email Validation', () => {
	it('should validate correct email formats', () => {
		expect(validateEmail('test@example.com').valid).toBe(true);
		expect(validateEmail('user.name@domain.co.uk').valid).toBe(true);
		expect(validateEmail('user+tag@example.com').valid).toBe(true);
	});

	it('should reject invalid email formats', () => {
		expect(validateEmail('invalid-email').valid).toBe(false);
		expect(validateEmail('@example.com').valid).toBe(false);
		expect(validateEmail('user@').valid).toBe(false);
		expect(validateEmail('user@domain').valid).toBe(false);
	});

	it('should reject empty email', () => {
		const result = validateEmail('');
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Email is required');
	});

	it('should provide error messages for invalid emails', () => {
		const result = validateEmail('invalid-email');
		expect(result.valid).toBe(false);
		expect(result.error).toBe('Invalid email format');
	});
});

describe('Password Validation', () => {
	it('should accept passwords with minimum length', () => {
		expect(validatePassword('123456').valid).toBe(true);
		expect(validatePassword('password123').valid).toBe(true);
	});

	it('should reject passwords shorter than minimum', () => {
		const result1 = validatePassword('12345');
		expect(result1.valid).toBe(false);
		expect(result1.error).toContain('at least 6 characters');

		const result2 = validatePassword('abc');
		expect(result2.valid).toBe(false);
	});

	it('should reject empty password', () => {
		const result = validatePassword('');
		expect(result.valid).toBe(false);
		expect(result.error).toContain('at least 6 characters');
	});

	it('should accept long passwords', () => {
		expect(validatePassword('thisIsAVeryLongPasswordWithManyCharacters123!').valid).toBe(true);
	});
});
