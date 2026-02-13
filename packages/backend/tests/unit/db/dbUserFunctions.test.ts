import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { getTestDb, cleanDatabase, seedTestData } from '../../db-utils.js';
import { returnUsers, returnUserByEmail, returnUserById } from '../../../src/db/dbUserFunctions.js';

describe('User Database Functions', () => {
	const testDb = getTestDb();

	beforeAll(async () => {
		await seedTestData(testDb);
	});

	afterEach(async () => {
		await cleanDatabase(testDb);
		await seedTestData(testDb);
	});

	describe('returnUsers', () => {
		it('should return all users', async () => {
			const users = await returnUsers();

			expect(users).toBeDefined();
			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBeGreaterThan(0);
		});
	});

	describe('returnUserByEmail', () => {
		it('should return user when email exists', async () => {
			const users = await returnUserByEmail('admin@test.com');

			expect(users).toBeDefined();
			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBe(1);
			expect(users[0].email).toBe('admin@test.com');
			expect(users[0].displayName).toBe('Test Admin');
			expect(users[0].roles).toContain('admin');
		});

		it('should return empty array when email does not exist', async () => {
			const users = await returnUserByEmail('nonexistent@test.com');

			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBe(0);
		});
	});

	describe('returnUserById', () => {
		it('should return user when ID exists', async () => {
			const users = await returnUserById('1');

			expect(users).toBeDefined();
			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBe(1);
			expect(users[0].userId).toBe(1);
			expect(users[0].email).toBe('admin@test.com');
		});

		it('should return empty array when ID does not exist', async () => {
			const users = await returnUserById('999');

			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBe(0);
		});
	});
});
