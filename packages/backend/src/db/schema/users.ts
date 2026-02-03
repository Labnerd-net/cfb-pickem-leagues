import 'dotenv/config';
import { boolean, integer, pgSchema, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

const userSchema = pgSchema('user');

// ------------------------------------------------------------------
// Users
// ------------------------------------------------------------------
export const users = userSchema.table('users', {
  userId: serial('user_id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').defaultNow(),
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
  seasonType: text('season_type').notNull(),
  completed: boolean('completed').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  homePoints: integer('home_points'),
  awayPoints: integer('away_points'),
  winningTeam: text('winning_team', { enum: ['home_team', 'away_team', 'pending'] }),
  teamChosen: text('team_chosen', { enum: ['home_team', 'away_team', 'pending'] }),
  createdAt: timestamp('created_at').defaultNow(),
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
