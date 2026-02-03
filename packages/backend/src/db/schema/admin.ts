import 'dotenv/config';
import { boolean, date, integer, pgSchema, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

const adminSchema = pgSchema('admin');

// ------------------------------------------------------------------
// AdminWeeks
// ------------------------------------------------------------------
export const adminWeeks = adminSchema.table('weeks', {
  weekId: integer('week_id').notNull().primaryKey(),
  weekNumber: integer('week_number').notNull(),
  year: integer('year').notNull(),
  seasonType: text('season_type').notNull(),
  weekStart: date('week_start').notNull(),
  weekEnd: date('week_end').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ------------------------------------------------------------------
// AdminGames – each game belongs to a week
// ------------------------------------------------------------------
export const adminGames = adminSchema.table('games', {
  gameId: serial('game_id').primaryKey(),
  weekId: integer('week_id')
    .notNull()
    .references(() => adminWeeks.weekId),
  picked: boolean('picked').notNull(),
  weekNumber: integer('week_number').notNull(),
  year: integer('year').notNull(),
  seasonType: text('season_type').notNull(),
  completed: boolean('completed').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  homePoints: integer('home_points'),
  awayPoints: integer('away_points'),
  winningTeam: text('winning_team', { enum: ['home_team', 'away_team', 'pending'] }),
  createdAt: timestamp('created_at').defaultNow(),
});

// ------------------------------------------------------------------
// Relation helpers
// ------------------------------------------------------------------
export const adminWeekRelations = relations(adminWeeks, ({ many }) => ({
  adminGames: many(adminGames),
}));

export const adminGameRelations = relations(adminGames, ({ one }) => ({
  adminWeeks: one(adminWeeks),
}));
