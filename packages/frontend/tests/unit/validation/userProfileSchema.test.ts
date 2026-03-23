import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Schemas mirroring Settings.tsx
const displayNameSchema = z.object({
	displayName: z
		.string()
		.trim()
		.min(1, 'Display name is required')
		.max(50, 'Display name must be 50 characters or fewer'),
});

const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, 'Current password is required'),
	newPassword: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.max(72, 'Password must be 72 characters or fewer'),
});

describe('Display Name Schema', () => {
	it('passes with a valid display name', () => {
		expect(displayNameSchema.safeParse({ displayName: 'John Doe' }).success).toBe(true);
	});

	it('passes with display name at max length (50)', () => {
		expect(displayNameSchema.safeParse({ displayName: 'a'.repeat(50) }).success).toBe(true);
	});

	it('passes with display name that needs trimming', () => {
		const result = displayNameSchema.safeParse({ displayName: '  Alice  ' });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.displayName).toBe('Alice');
	});

	it('fails with empty display name', () => {
		expect(displayNameSchema.safeParse({ displayName: '' }).success).toBe(false);
	});

	it('fails with whitespace-only display name', () => {
		expect(displayNameSchema.safeParse({ displayName: '   ' }).success).toBe(false);
	});

	it('fails with display name exceeding 50 characters', () => {
		expect(displayNameSchema.safeParse({ displayName: 'a'.repeat(51) }).success).toBe(false);
	});
});

describe('Change Password Schema', () => {
	it('passes with valid current and new password', () => {
		expect(
			changePasswordSchema.safeParse({ currentPassword: 'oldpass1', newPassword: 'newpass1' }).success
		).toBe(true);
	});

	it('passes with new password at min length (8)', () => {
		expect(
			changePasswordSchema.safeParse({ currentPassword: 'oldpass1', newPassword: '12345678' }).success
		).toBe(true);
	});

	it('passes with new password at max length (72)', () => {
		expect(
			changePasswordSchema.safeParse({ currentPassword: 'oldpass1', newPassword: 'a'.repeat(72) }).success
		).toBe(true);
	});

	it('fails when new password is too short (7 chars)', () => {
		expect(
			changePasswordSchema.safeParse({ currentPassword: 'oldpass1', newPassword: '1234567' }).success
		).toBe(false);
	});

	it('fails when new password exceeds 72 characters', () => {
		expect(
			changePasswordSchema.safeParse({ currentPassword: 'oldpass1', newPassword: 'a'.repeat(73) }).success
		).toBe(false);
	});

	it('fails when currentPassword is empty', () => {
		expect(
			changePasswordSchema.safeParse({ currentPassword: '', newPassword: 'newpass123' }).success
		).toBe(false);
	});
});
