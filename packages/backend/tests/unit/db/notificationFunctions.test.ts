import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { seedTestData, cleanDatabase, createTestNotificationPreference, createTestNotificationLog } from '../../db-utils.js';
import {
	upsertNotificationPreference,
	addNotificationLog,
	hasNotificationBeenSent,
	markEmailVerified,
	updateUserNtfyUrl,
	returnNotificationSettings,
	returnNotificationPreferences,
} from '../../../src/db/dbNotificationFunctions.js';
import { setEmailVerificationToken } from '../../../src/db/dbNotificationFunctions.js';
import { db } from '../../../src/db/index.js';
import { sql } from 'drizzle-orm';

describe('Notification Database Functions', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	afterEach(async () => {
		await cleanDatabase();
		await seedTestData();
	});

	describe('upsertNotificationPreference', () => {
		it('should create a new preference', async () => {
			await upsertNotificationPreference(1, 'games_ready', 'email', true);
			const prefs = await returnNotificationPreferences(1);
			const pref = prefs.find(p => p.notificationType === 'games_ready' && p.channel === 'email');
			expect(pref).toBeDefined();
			expect(pref?.enabled).toBe(true);
		});

		it('should update an existing preference (idempotent)', async () => {
			await upsertNotificationPreference(1, 'games_ready', 'email', true);
			await upsertNotificationPreference(1, 'games_ready', 'email', false);
			const prefs = await returnNotificationPreferences(1);
			const matches = prefs.filter(p => p.notificationType === 'games_ready' && p.channel === 'email');
			expect(matches).toHaveLength(1);
			expect(matches[0].enabled).toBe(false);
		});
	});

	describe('addNotificationLog + hasNotificationBeenSent', () => {
		it('should return false before adding a log entry', async () => {
			const sent = await hasNotificationBeenSent(1, 2024, 1, 'games_ready', 'email');
			expect(sent).toBe(false);
		});

		it('should return true after adding a log entry', async () => {
			await addNotificationLog(1, 2024, 1, 'games_ready', 'email');
			const sent = await hasNotificationBeenSent(1, 2024, 1, 'games_ready', 'email');
			expect(sent).toBe(true);
		});

		it('should not error on duplicate log entry', async () => {
			await addNotificationLog(1, 2024, 1, 'games_ready', 'ntfy');
			await expect(addNotificationLog(1, 2024, 1, 'games_ready', 'ntfy')).resolves.not.toThrow();
		});
	});

	describe('markEmailVerified', () => {
		it('should verify email with valid token', async () => {
			const token = 'test-verification-token-valid';
			await setEmailVerificationToken(1, token, new Date());
			const result = await markEmailVerified(token);
			expect(result).not.toBeNull();
			expect(result?.userId).toBe(1);

			// Check email_verified is now true
			const rows = await db.execute(sql`SELECT email_verified FROM "user".users WHERE user_id = 1`);
			expect(rows.rows[0]?.email_verified).toBe(true);
		});

		it('should return null for invalid token', async () => {
			const result = await markEmailVerified('invalid-token-does-not-exist');
			expect(result).toBeNull();
		});

		it('should clear the token after verification', async () => {
			const token = 'test-token-cleared';
			await setEmailVerificationToken(1, token, new Date());
			await markEmailVerified(token);
			const rows = await db.execute(sql`SELECT email_verification_token FROM "user".users WHERE user_id = 1`);
			expect(rows.rows[0]?.email_verification_token).toBeNull();
		});
	});

	describe('updateUserNtfyUrl', () => {
		it('should set the ntfy server URL', async () => {
			await updateUserNtfyUrl(1, 'https://ntfy.sh');
			const rows = await db.execute(sql`SELECT ntfy_server_url FROM "user".users WHERE user_id = 1`);
			expect(rows.rows[0]?.ntfy_server_url).toBe('https://ntfy.sh');
		});

		it('should clear the ntfy server URL when null is passed', async () => {
			await updateUserNtfyUrl(1, 'https://ntfy.sh');
			await updateUserNtfyUrl(1, null);
			const rows = await db.execute(sql`SELECT ntfy_server_url FROM "user".users WHERE user_id = 1`);
			expect(rows.rows[0]?.ntfy_server_url).toBeNull();
		});
	});

	describe('returnNotificationSettings', () => {
		it('should return defaults for a new user with no preferences', async () => {
			const settings = await returnNotificationSettings(1);
			expect(settings.emailVerified).toBe(false);
			expect(settings.ntfyServerUrl).toBeNull();
			expect(settings.preferences).toEqual([]);
		});

		it('should include preferences when they exist', async () => {
			await createTestNotificationPreference(1, 'games_ready', 'email', false);
			const settings = await returnNotificationSettings(1);
			expect(settings.preferences).toHaveLength(1);
			expect(settings.preferences[0].enabled).toBe(false);
		});
	});
});
