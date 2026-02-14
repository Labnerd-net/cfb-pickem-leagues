import { sql } from 'drizzle-orm';
import type { Role } from '@shared/types/cfb-pickem-api.js';
import bcrypt from 'bcryptjs';
import { db } from '../src/db/index.js';

// Re-export the mocked db instance for tests
export { db as testDb };

/**
 * Clean all data from test database tables (preserves schema)
 * Respects foreign key constraints by truncating in correct order
 * Note: With PGlite, each test file gets a fresh DB, so this is rarely needed
 */
export async function cleanDatabase() {
	await db.execute(sql`TRUNCATE TABLE "user"."games" CASCADE`);
	await db.execute(sql`TRUNCATE TABLE "user"."users" RESTART IDENTITY CASCADE`);
	await db.execute(sql`TRUNCATE TABLE "admin"."games" RESTART IDENTITY CASCADE`);
	await db.execute(sql`TRUNCATE TABLE "admin"."weeks" CASCADE`);
}

/**
 * Seed minimal test data required for tests
 */
export async function seedTestData() {
	// Insert a test week (2024 week 1, regular season)
	await db.execute(sql`
		INSERT INTO "admin"."weeks" (week_number, year, season_type, week_start, week_end)
		VALUES (1, 2024, 'regular', '2024-08-24', '2024-08-31')
		ON CONFLICT (year, week_number) DO NOTHING
	`);

	// Insert a test admin user
	const passwordHash = await bcrypt.hash('password123', 10);
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
	const passwordHash = await bcrypt.hash(password, 10);
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
	picked = false,
	completed = false,
) {
	const result = await db.execute(sql`
		INSERT INTO "admin"."games" (
			week_number, year, season_type, picked, completed,
			home_team, away_team, home_points, away_points, winning_team
		)
		VALUES (
			${weekNumber}, ${year}, 'regular', ${picked}, ${completed},
			${homeTeam}, ${awayTeam}, -1, -1, 'pending'
		)
		RETURNING game_id
	`);
	return result.rows[0];
}
