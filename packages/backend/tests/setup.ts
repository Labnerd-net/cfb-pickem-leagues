import 'dotenv/config';
import { vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

// Override environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-do-not-use-in-production';
process.env.CFBD_API_KEY = 'test-cfbd-key';

// Set global test timeout
vi.setConfig({ testTimeout: 10000 });

// Mock the db module with PGlite
vi.mock('../src/db/index.ts', async () => {
	// Create a fresh PGlite instance for each test file
	const client = new PGlite();
	const db = drizzle(client);

	// Apply schema - create admin and user schemas
	await client.exec(`
		CREATE SCHEMA IF NOT EXISTS admin;
		CREATE SCHEMA IF NOT EXISTS "user";

		-- Admin schema: weeks table
		CREATE TABLE admin.weeks (
			week_number INTEGER NOT NULL,
			year INTEGER NOT NULL,
			season_type TEXT NOT NULL,
			week_start DATE NOT NULL,
			week_end DATE NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
			PRIMARY KEY (year, week_number)
		);

		CREATE INDEX weeks_year_season_idx ON admin.weeks (year, season_type);

		-- Admin schema: games table
		CREATE TABLE admin.games (
			game_id SERIAL PRIMARY KEY,
			cfbd_game_id INTEGER,
			picked BOOLEAN NOT NULL,
			week_number INTEGER NOT NULL,
			year INTEGER NOT NULL,
			season_type TEXT NOT NULL,
			completed BOOLEAN NOT NULL,
			home_team TEXT NOT NULL,
			away_team TEXT NOT NULL,
			home_points INTEGER,
			away_points INTEGER,
			winning_team TEXT NOT NULL DEFAULT 'pending',
			start_time TIMESTAMP,
			spread REAL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
			CONSTRAINT games_week_fk FOREIGN KEY (year, week_number)
				REFERENCES admin.weeks (year, week_number) ON DELETE CASCADE
		);

		CREATE INDEX games_year_week_idx ON admin.games (year, week_number);
		CREATE INDEX games_picked_idx ON admin.games (picked);
		CREATE INDEX games_year_week_picked_idx ON admin.games (year, week_number, picked);
		ALTER TABLE admin.games ADD CONSTRAINT games_natural_key UNIQUE (year, week_number, home_team, away_team);

		-- Admin schema: score corrections audit log
		CREATE TABLE admin.score_corrections (
			id SERIAL PRIMARY KEY,
			game_id INTEGER NOT NULL REFERENCES admin.games (game_id) ON DELETE CASCADE,
			corrected_by INTEGER NOT NULL,
			corrected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
			old_home_points INTEGER,
			old_away_points INTEGER,
			new_home_points INTEGER NOT NULL,
			new_away_points INTEGER NOT NULL
		);

		-- User schema: users table
		CREATE TABLE "user".users (
			user_id SERIAL PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			display_name TEXT NOT NULL DEFAULT '',
			password_hash TEXT NOT NULL,
			roles TEXT[] NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
			email_verified BOOLEAN DEFAULT FALSE,
			email_verification_token TEXT,
			email_verification_sent_at TIMESTAMP
		);

		-- User schema: deleted_users audit table
		CREATE TABLE "user".deleted_users (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			email TEXT NOT NULL,
			display_name TEXT NOT NULL,
			roles TEXT[] NOT NULL,
			created_at TIMESTAMP NOT NULL,
			deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
		);

		-- User schema: games table (picks only; join with admin.games for metadata)
		CREATE TABLE "user".games (
			user_id INTEGER NOT NULL REFERENCES "user".users (user_id) ON DELETE CASCADE,
			game_id INTEGER NOT NULL,
			team_chosen TEXT NOT NULL DEFAULT 'pending',
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
			PRIMARY KEY (user_id, game_id),
			CONSTRAINT user_games_admin_games_fk FOREIGN KEY (game_id)
				REFERENCES admin.games (game_id) ON DELETE CASCADE
		);

		-- User schema: notification preferences
		CREATE TABLE "user".notification_preferences (
			user_id INTEGER NOT NULL REFERENCES "user".users (user_id) ON DELETE CASCADE,
			notification_type TEXT NOT NULL,
			channel TEXT NOT NULL,
			enabled BOOLEAN NOT NULL DEFAULT TRUE,
			PRIMARY KEY (user_id, notification_type, channel)
		);

		-- User schema: notification log (deduplication)
		-- user_id = 0 is used as a sentinel for broadcast channel entries (no FK)
		CREATE TABLE "user".notification_log (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			year INTEGER NOT NULL,
			week_number INTEGER NOT NULL,
			notification_type TEXT NOT NULL,
			channel TEXT NOT NULL,
			sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
			CONSTRAINT notification_log_unique UNIQUE (user_id, year, week_number, notification_type, channel)
		);
	`);

	// Export the custom column types
	const customType = (await import('drizzle-orm/pg-core')).customType;

	return {
		db,
		columnSeason: customType({
			dataType() {
				return 'text';
			},
		}),
		columnTeam: customType({
			dataType() {
				return 'text';
			},
		}),
		columnRole: customType({
			dataType() {
				return 'text';
			},
		}),
	};
});
