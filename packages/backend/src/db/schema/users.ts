import 'dotenv/config';
import { boolean, customType, integer, pgSchema, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { SeasonType, Team } from '@shared/types/cfb-pickem-api.js';

export const columnSeason = customType<{data: SeasonType}>({
  dataType() { return 'text' },
});

export const columnTeam = customType<{data: Team}>({
  dataType() { return 'text' },
});

const userSchema = pgSchema('user');

// ------------------------------------------------------------------
// Users
// ------------------------------------------------------------------
export const users = userSchema.table('users', {
  userId: serial('user_id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ------------------------------------------------------------------
// Games – each game belongs to a user
// ------------------------------------------------------------------
export const games = userSchema.table('games', {
  gameId: integer('game_id').notNull().primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.userId),
  weekId: integer('week_id').notNull(),
  weekNumber: integer('week_number').notNull(),
  year: integer('year').notNull(),
  seasonType: columnSeason('season_type').notNull(),
  completed: boolean('completed').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  homePoints: integer('home_points'),
  awayPoints: integer('away_points'),
  winningTeam: columnTeam('winning_team').notNull().default('pending'),
  teamChosen: columnTeam('team_chosen').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ------------------------------------------------------------------
// Relation helpers
// ------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  games: many(games),
}));

export const gameRelations = relations(games, ({ one }) => ({
  user: one(users),
}));
