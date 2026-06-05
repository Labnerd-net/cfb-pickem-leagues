import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { seedTestData, cleanDatabase, createTestNotificationPreference, createLeagueGame, createTestGame } from '../../db-utils.js';
import {
	upsertNotificationPreference,
	addNotificationLog,
	hasNotificationBeenSent,
	returnSentNotificationUserIds,
	markEmailVerified,
	returnNotificationSettings,
	returnNotificationPreferences,
	returnNotificationLogs,
	returnEmailOptedInUsers,
	getActiveLeaguesForWeek,
	setEmailVerificationToken,
} from '../../../src/db/dbNotificationFunctions.js';
import { getLeaguesForGame } from '../../../src/db/dbLeagueFunctions.js';
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
			const sent = await hasNotificationBeenSent(1, 1, 2024, 1, 'games_ready', 'email');
			expect(sent).toBe(false);
		});

		it('should return true after adding a log entry', async () => {
			await addNotificationLog(1, 1, 2024, 1, 'games_ready', 'email');
			const sent = await hasNotificationBeenSent(1, 1, 2024, 1, 'games_ready', 'email');
			expect(sent).toBe(true);
		});

		it('should not error on duplicate log entry', async () => {
			await addNotificationLog(1, 1, 2024, 1, 'games_ready', 'email');
			await expect(addNotificationLog(1, 1, 2024, 1, 'games_ready', 'email')).resolves.not.toThrow();
		});

		it('should support userId = 0 as broadcast sentinel', async () => {
			await addNotificationLog(0, 1, 2024, 1, 'games_ready', 'ntfy');
			const sent = await hasNotificationBeenSent(0, 1, 2024, 1, 'games_ready', 'ntfy');
			expect(sent).toBe(true);
		});

		it('should deduplicate broadcast entries (no error on duplicate)', async () => {
			await addNotificationLog(0, 1, 2024, 1, 'games_ready', 'telegram');
			await expect(addNotificationLog(0, 1, 2024, 1, 'games_ready', 'telegram')).resolves.not.toThrow();
		});

		it('should allow the same user+week+type+channel with different leagueId', async () => {
			await addNotificationLog(1, 1, 2024, 1, 'rankings_updated', 'email');
			// Same user, same week, same type — but different league — should not conflict
			await expect(addNotificationLog(1, 2, 2024, 1, 'rankings_updated', 'email')).resolves.not.toThrow();
			const sentLeague1 = await hasNotificationBeenSent(1, 1, 2024, 1, 'rankings_updated', 'email');
			const sentLeague2 = await hasNotificationBeenSent(1, 2, 2024, 1, 'rankings_updated', 'email');
			expect(sentLeague1).toBe(true);
			expect(sentLeague2).toBe(true);
		});
	});

	describe('returnSentNotificationUserIds', () => {
		it('should return an empty Set when no log entries exist', async () => {
			const result = await returnSentNotificationUserIds(1, 2024, 1, 'games_ready', 'email');
			expect(result).toBeInstanceOf(Set);
			expect(result.size).toBe(0);
		});

		it('should return a Set containing IDs of users with log entries for the tuple', async () => {
			await addNotificationLog(1, 1, 2024, 1, 'games_ready', 'email');
			await addNotificationLog(2, 1, 2024, 1, 'games_ready', 'email');
			// Different channel — should not appear
			await addNotificationLog(3, 1, 2024, 1, 'games_ready', 'ntfy');

			const result = await returnSentNotificationUserIds(1, 2024, 1, 'games_ready', 'email');
			expect(result.has(1)).toBe(true);
			expect(result.has(2)).toBe(true);
			expect(result.has(3)).toBe(false);
			expect(result.size).toBe(2);
		});

		it('should not include entries from a different leagueId', async () => {
			await addNotificationLog(1, 1, 2024, 1, 'rankings_updated', 'email');
			// Query for league 2 — should return empty
			const result = await returnSentNotificationUserIds(2, 2024, 1, 'rankings_updated', 'email');
			expect(result.size).toBe(0);
		});
	});

	describe('returnEmailOptedInUsers', () => {
		it('returns all users when leagueId = 0 (site-wide)', async () => {
			const users = await returnEmailOptedInUsers('games_ready', 0);
			// Both test users (id=1 and id=2) should be returned (no preference row = opted in)
			expect(users.length).toBeGreaterThanOrEqual(2);
		});

		it('returns only league members when leagueId > 0', async () => {
			// League 1 has both users seeded (admin user 1 + regular user 2)
			const allUsers = await returnEmailOptedInUsers('games_ready', 0);
			const leagueUsers = await returnEmailOptedInUsers('games_ready', 1);
			// League-scoped result should be <= global result
			expect(leagueUsers.length).toBeLessThanOrEqual(allUsers.length);
			// All returned users should be in league 1
			const leagueUserIds = leagueUsers.map(u => u.userId);
			expect(leagueUserIds).toContain(1);
			expect(leagueUserIds).toContain(2);
		});

		it('returns empty array for a league with no members', async () => {
			// Create a second league with no members via direct SQL
			await db.execute(sql`
				INSERT INTO leagues (league_id, name, invite_code, created_by)
				VALUES (99, 'Empty League', 'empty-code-99', 1)
				ON CONFLICT DO NOTHING
			`);
			const users = await returnEmailOptedInUsers('games_ready', 99);
			expect(users).toHaveLength(0);
		});

		it('respects opt-out preferences in league scope', async () => {
			// Opt user 2 out
			await upsertNotificationPreference(2, 'games_ready', 'email', false);
			const users = await returnEmailOptedInUsers('games_ready', 1);
			const userIds = users.map(u => u.userId);
			expect(userIds).not.toContain(2);
			expect(userIds).toContain(1);
		});
	});

	describe('getActiveLeaguesForWeek', () => {
		it('returns empty array when no leagues have games', async () => {
			const result = await getActiveLeaguesForWeek(2024, 1);
			expect(result).toHaveLength(0);
		});

		it('returns leagues that have at least one game for the week', async () => {
			const game = await createTestGame(1, 2024, 'Team A', 'Team B');
			await createLeagueGame(1, game.game_id as number);
			const result = await getActiveLeaguesForWeek(2024, 1);
			expect(result).toHaveLength(1);
			expect(result[0].leagueId).toBe(1);
			expect(result[0].name).toBe('Default League');
		});

		it('returns only distinct leagues (not duplicated per game)', async () => {
			const game1 = await createTestGame(1, 2024, 'Team A', 'Team B');
			const game2 = await createTestGame(1, 2024, 'Team C', 'Team D');
			await createLeagueGame(1, game1.game_id as number);
			await createLeagueGame(1, game2.game_id as number);
			const result = await getActiveLeaguesForWeek(2024, 1);
			expect(result).toHaveLength(1);
		});

		it('does not return leagues with games only in a different week', async () => {
			const game = await createTestGame(2, 2024, 'Team A', 'Team B');
			await createLeagueGame(1, game.game_id as number);
			const result = await getActiveLeaguesForWeek(2024, 1);
			expect(result).toHaveLength(0);
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

		it('should return null for an expired token (sent > 24h ago)', async () => {
			const token = 'test-token-expired';
			const expiredAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
			await setEmailVerificationToken(1, token, expiredAt);
			const result = await markEmailVerified(token);
			expect(result).toBeNull();
		});
	});

	describe('returnNotificationLogs', () => {
		it('returns all entries and correct total with no filters', async () => {
			await addNotificationLog(1, 1, 2024, 1, 'games_ready', 'email');
			await addNotificationLog(1, 1, 2024, 1, 'picks_reminder_1h', 'ntfy');
			const { entries, total } = await returnNotificationLogs(50, 0);
			expect(total).toBe(2);
			expect(entries).toHaveLength(2);
		});

		it('filters by channel and returns correct total', async () => {
			await addNotificationLog(1, 1, 2024, 1, 'games_ready', 'email');
			await addNotificationLog(1, 1, 2024, 1, 'picks_reminder_1h', 'ntfy');
			const { entries, total } = await returnNotificationLogs(50, 0, 'email');
			expect(total).toBe(1);
			expect(entries).toHaveLength(1);
			expect(entries[0].channel).toBe('email');
		});

		it('filters by notificationType and returns correct total', async () => {
			await addNotificationLog(1, 1, 2024, 1, 'games_ready', 'email');
			await addNotificationLog(1, 1, 2024, 1, 'picks_reminder_1h', 'email');
			const { entries, total } = await returnNotificationLogs(50, 0, undefined, 'games_ready');
			expect(total).toBe(1);
			expect(entries).toHaveLength(1);
			expect(entries[0].notificationType).toBe('games_ready');
		});

		it('ANDs channel and notificationType filters', async () => {
			await addNotificationLog(1, 1, 2024, 1, 'games_ready', 'email');
			await addNotificationLog(1, 1, 2024, 1, 'games_ready', 'ntfy');
			await addNotificationLog(1, 1, 2024, 1, 'picks_reminder_1h', 'email');
			const { entries, total } = await returnNotificationLogs(50, 0, 'email', 'games_ready');
			expect(total).toBe(1);
			expect(entries).toHaveLength(1);
			expect(entries[0].channel).toBe('email');
			expect(entries[0].notificationType).toBe('games_ready');
		});

		it('returns empty entries and total 0 when filter matches nothing', async () => {
			await addNotificationLog(1, 1, 2024, 1, 'games_ready', 'email');
			const { entries, total } = await returnNotificationLogs(50, 0, 'discord');
			expect(total).toBe(0);
			expect(entries).toHaveLength(0);
		});
	});

	describe('returnNotificationSettings', () => {
		it('should return defaults for a new user with no preferences', async () => {
			const settings = await returnNotificationSettings(1);
			expect(settings.emailVerified).toBe(false);
			expect(settings).not.toHaveProperty('ntfyServerUrl');
			expect(settings.preferences).toEqual([]);
		});

		it('should include preferences when they exist', async () => {
			await createTestNotificationPreference(1, 'games_ready', 'email', false);
			const settings = await returnNotificationSettings(1);
			expect(settings.preferences).toHaveLength(1);
			expect(settings.preferences[0].enabled).toBe(false);
		});
	});

	describe('getLeaguesForGame', () => {
		it('returns empty array when game is not in any league pool', async () => {
			const game = await createTestGame(1, 2024, 'Team A', 'Team B');
			const result = await getLeaguesForGame(game.game_id as number);
			expect(result).toHaveLength(0);
		});

		it('returns the league when game is in one league pool', async () => {
			const game = await createTestGame(1, 2024, 'Team A', 'Team B');
			await createLeagueGame(1, game.game_id as number);
			const result = await getLeaguesForGame(game.game_id as number);
			expect(result).toHaveLength(1);
			expect(result[0].leagueId).toBe(1);
		});

		it('returns multiple leagues when game is in multiple pools', async () => {
			const game = await createTestGame(1, 2024, 'Team A', 'Team B');
			await db.execute(sql`
				INSERT INTO leagues (league_id, name, invite_code, created_by)
				VALUES (2, 'Second League', 'second00', 1)
				ON CONFLICT DO NOTHING
			`);
			await createLeagueGame(1, game.game_id as number);
			await createLeagueGame(2, game.game_id as number);
			const result = await getLeaguesForGame(game.game_id as number);
			expect(result).toHaveLength(2);
			const ids = result.map(r => r.leagueId).sort((a, b) => a - b);
			expect(ids).toEqual([1, 2]);
		});
	});
});
