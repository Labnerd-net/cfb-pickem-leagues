import { sql } from 'drizzle-orm';
import type { NotificationChannel, NotificationType, Role, UserGamePicks } from '@shared/types/cfb-pickem-api.js';
import { hashPassword } from '../src/utils/password.js';
import { db } from '../src/db/index.js';
import { addPickedGamesBatch } from '../src/db/dbUserFunctions.js';

// Re-export the mocked db instance for tests
export { db as testDb };

/**
 * Clean all data from test database tables (preserves schema)
 * Respects foreign key constraints by truncating in correct order
 * Note: With PGlite, each test file gets a fresh DB, so this is rarely needed
 */
export async function cleanDatabase() {
	await db.execute(sql`TRUNCATE TABLE "user"."notification_log", "user"."notification_preferences" CASCADE`);
	await db.execute(sql`TRUNCATE TABLE "user"."games" CASCADE`);
	await db.execute(sql`TRUNCATE TABLE league_channels, league_games, league_members, leagues RESTART IDENTITY CASCADE`);
	await db.execute(sql`TRUNCATE TABLE "user"."users" RESTART IDENTITY CASCADE`);
	await db.execute(sql`TRUNCATE TABLE "user"."deleted_users" RESTART IDENTITY CASCADE`);
	await db.execute(sql`TRUNCATE TABLE "admin"."games" RESTART IDENTITY CASCADE`);
	await db.execute(sql`TRUNCATE TABLE "admin"."weeks" CASCADE`);
}

/**
 * Seed minimal test data required for tests
 */
export async function seedTestData() {
	// Insert a 2 test weeks (2024 week 1 & 2, regular season)
	await db.execute(sql`
		INSERT INTO "admin"."weeks" (week_number, year, season_type, week_start, week_end)
		VALUES (1, 2024, 'regular', '2024-08-24', '2024-08-31')
		ON CONFLICT (year, week_number) DO NOTHING
	`);
	await db.execute(sql`
		INSERT INTO "admin"."weeks" (week_number, year, season_type, week_start, week_end)
		VALUES (2, 2024, 'regular', '2024-08-31', '2024-09-07')
		ON CONFLICT (year, week_number) DO NOTHING
	`);

	// Insert a test admin user
	const passwordHash = await hashPassword('password123');
	await db.execute(sql`
		INSERT INTO "user"."users" (user_id, email, display_name, password_hash, roles)
		VALUES (1, 'admin@test.com', 'Test Admin', ${passwordHash}, ARRAY['admin', 'user']::text[])
		ON CONFLICT (email) DO NOTHING
	`);

	// Insert a test regular user
	await db.execute(sql`
		INSERT INTO "user"."users" (user_id, email, display_name, password_hash, roles)
		VALUES (2, 'user@test.com', 'Test User', ${passwordHash}, ARRAY['user']::text[])
		ON CONFLICT (email) DO NOTHING
	`);

	// Insert a Default League and add both test users as members
	await db.execute(sql`
		INSERT INTO leagues (league_id, name, invite_code, created_by)
		OVERRIDING SYSTEM VALUE
		VALUES (1, 'Default League', 'default00', 1)
		ON CONFLICT (league_id) DO NOTHING
	`);
	await db.execute(sql`
		INSERT INTO league_members (league_id, user_id, role)
		VALUES (1, 1, 'admin'), (1, 2, 'member')
		ON CONFLICT (league_id, user_id) DO NOTHING
	`);
}

/**
 * Helper to create a test user with specific roles
 */
export async function createTestUser(
	email: string,
	displayName: string,
	roles: Role[],
	password = 'password123',
) {
	const passwordHash = await hashPassword(password);
	const result = await db.execute(sql`
		INSERT INTO "user"."users" (email, display_name, password_hash, roles)
		VALUES (${email}, ${displayName}, ${passwordHash}, ${sql.raw(`ARRAY[${roles.map((r) => `'${r}'`).join(',')}]::text[]`)})
		RETURNING user_id
	`);
	return result.rows[0];
}

/**
 * Helper to create a test week
 */
export async function createTestWeek(
	weekNumber: number,
	year: number,
	seasonType: string = 'regular',
) {
	await db.execute(sql`
		INSERT INTO "admin"."weeks" (week_number, year, season_type, week_start, week_end)
		VALUES (
			${weekNumber},
			${year},
			${seasonType},
			'2024-08-24',
			'2024-08-31'
		)
		ON CONFLICT (year, week_number) DO NOTHING
	`);
}

/**
 * Helper to create a test game
 */
export async function createTestGame(
	weekNumber: number,
	year: number,
	homeTeam: string,
	awayTeam: string,
	completed = false,
	startTime: Date | null = null,
) {
	const result = await db.execute(sql`
		INSERT INTO "admin"."games" (
			week_number, year, season_type, completed,
			home_team, away_team, home_points, away_points, winning_team, start_time
		)
		VALUES (
			${weekNumber}, ${year}, 'regular', ${completed},
			${homeTeam}, ${awayTeam}, NULL, NULL, 'pending', ${startTime}
		)
		RETURNING game_id
	`);
	return result.rows[0];
}

/**
 * Helper to add a game to a league's pool
 */
export async function createLeagueGame(leagueId: number, gameId: number) {
	await db.execute(sql`
		INSERT INTO league_games (league_id, game_id)
		VALUES (${leagueId}, ${gameId})
		ON CONFLICT (league_id, game_id) DO NOTHING
	`);
}

/**
 * Helper to create a user pick (user.games row)
 */
export async function createTestPick(userId: number, gameId: number, leagueId = 1) {
	await db.execute(sql`
		INSERT INTO "user"."games" (user_id, game_id, league_id, team_chosen)
		VALUES (${userId}, ${gameId}, ${leagueId}, 'home_team')
		ON CONFLICT (user_id, game_id, league_id) DO NOTHING
	`);
}

/**
 * Helper to create a test notification preference
 */
export async function createTestNotificationPreference(
	userId: number,
	notificationType: NotificationType,
	channel: NotificationChannel,
	enabled = true,
) {
	await db.execute(sql`
		INSERT INTO "user"."notification_preferences" (user_id, notification_type, channel, enabled)
		VALUES (${userId}, ${notificationType}, ${channel}, ${enabled})
		ON CONFLICT (user_id, notification_type, channel) DO UPDATE SET enabled = ${enabled}
	`);
}

/**
 * Test helper: insert a single pick via addPickedGamesBatch
 */
export async function addPickedGame(pick: UserGamePicks, userId: number, leagueId = 1) {
	await addPickedGamesBatch([pick], userId, leagueId);
}

/**
 * Helper to create a test notification log entry
 */
export async function createTestNotificationLog(
	userId: number,
	leagueId: number,
	year: number,
	weekNumber: number,
	notificationType: NotificationType,
	channel: NotificationChannel,
) {
	await db.execute(sql`
		INSERT INTO "user"."notification_log" (user_id, league_id, year, week_number, notification_type, channel)
		VALUES (${userId}, ${leagueId}, ${year}, ${weekNumber}, ${notificationType}, ${channel})
		ON CONFLICT (user_id, league_id, year, week_number, notification_type, channel) DO NOTHING
	`);
}
