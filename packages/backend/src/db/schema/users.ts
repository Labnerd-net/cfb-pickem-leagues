import 'dotenv/config';
import { boolean, index, integer, pgSchema, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { columnRole, columnSeason, columnTeam } from '../index.js';
// import { columnRole, columnSeason, columnTeam } from '../index'; // for drizzle-kit generate

const userSchema = pgSchema('user');

// ------------------------------------------------------------------
// Users
// ------------------------------------------------------------------
export const users = userSchema.table('users', {
  userId: serial('user_id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  roles: columnRole('roles').array().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ------------------------------------------------------------------
// Games – each game belongs to a user
// ------------------------------------------------------------------
export const games = userSchema.table('games', {
  userId: integer('user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  gameId: integer('game_id').notNull(),
  cfbdGameId: integer('cfbd_game_id'),
  ncaaGameId: text('ncaa_game_id'),
  weekId: integer('week_id').notNull(),
  weekNumber: integer('week_number').notNull(),
  year: integer('year').notNull(),
  seasonType: columnSeason('season_type').notNull(),
  completed: boolean('completed').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  homePoints: integer('home_points').notNull(),
  awayPoints: integer('away_points').notNull(),
  winningTeam: columnTeam('winning_team').notNull().default('pending'),
  teamChosen: columnTeam('team_chosen').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  primaryKey({ columns: [table.userId, table.gameId] }),
  index('user_games_week_id_idx').on(table.weekId),
  index('user_games_user_id_week_id_idx').on(table.userId, table.weekId),
]));

// ------------------------------------------------------------------
// Relation helpers
// ------------------------------------------------------------------
export const usersRelations = relations(users, ({ many }) => ({
  games: many(games),
}));

export const gameRelations = relations(games, ({ one }) => ({
  user: one(users),
}));
