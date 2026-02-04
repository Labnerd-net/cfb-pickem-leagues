import 'dotenv/config';
import { boolean, customType, date, integer, pgSchema, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { SeasonType, Team } from '@shared/types/cfb-pickem-api.js';

export const columnSeason = customType<{data: SeasonType}>({
  dataType() { return 'text' },
});

export const columnTeam = customType<{data: Team}>({
  dataType() { return 'text' },
});

const adminSchema = pgSchema('admin');

// ------------------------------------------------------------------
// AdminWeeks
// ------------------------------------------------------------------
export const adminWeeks = adminSchema.table('weeks', {
  weekId: integer('week_id').notNull().primaryKey(),
  weekNumber: integer('week_number').notNull(),
  year: integer('year').notNull(),
  seasonType: columnSeason('season_type').notNull(),
  weekStart: date('week_start').notNull(),
  weekEnd: date('week_end').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  seasonType: columnSeason('season_type').notNull(),
  completed: boolean('completed').notNull(),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  homePoints: integer('home_points').notNull().default(-1),
  awayPoints: integer('away_points').notNull().default(-1),
  winningTeam: columnTeam('winning_team').notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
