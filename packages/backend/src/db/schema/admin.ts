import 'dotenv/config';
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  pgSchema,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { columnSeason, columnTeam } from '../index.js';
// import { columnSeason, columnTeam } from '../index'; // for drizzle-kit generate

const adminSchema = pgSchema('admin');

// ------------------------------------------------------------------
// AdminWeeks
// ------------------------------------------------------------------
export const adminWeeks = adminSchema.table(
  'weeks',
  {
    weekNumber: integer('week_number').notNull(),
    year: integer('year').notNull(),
    seasonType: columnSeason('season_type').notNull(),
    weekStart: date('week_start').notNull(),
    weekEnd: date('week_end').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => [
    primaryKey({ columns: [table.year, table.weekNumber] }),
    index('weeks_year_season_idx').on(table.year, table.seasonType),
  ]
);

// ------------------------------------------------------------------
// AdminGames – each game belongs to a week
// ------------------------------------------------------------------
export const adminGames = adminSchema.table(
  'games',
  {
    gameId: serial('game_id').primaryKey(),
    cfbdGameId: integer('cfbd_game_id'),
    ncaaGameId: text('ncaa_game_id'),
    picked: boolean('picked').notNull(),
    weekNumber: integer('week_number').notNull(),
    year: integer('year').notNull(),
    seasonType: columnSeason('season_type').notNull(),
    completed: boolean('completed').notNull(),
    homeTeam: text('home_team').notNull(),
    awayTeam: text('away_team').notNull(),
    homePoints: integer('home_points'),
    awayPoints: integer('away_points'),
    winningTeam: columnTeam('winning_team').notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.year, table.weekNumber],
      foreignColumns: [adminWeeks.year, adminWeeks.weekNumber],
      name: 'games_week_fk',
    }).onDelete('cascade'),
    index('games_year_week_idx').on(table.year, table.weekNumber),
    index('games_picked_idx').on(table.picked),
    index('games_year_week_picked_idx').on(table.year, table.weekNumber, table.picked),
  ]
);

// ------------------------------------------------------------------
// Relation helpers
// ------------------------------------------------------------------
export const adminWeekRelations = relations(adminWeeks, ({ many }) => ({
  adminGames: many(adminGames),
}));

export const adminGameRelations = relations(adminGames, ({ one }) => ({
  adminWeeks: one(adminWeeks),
}));
