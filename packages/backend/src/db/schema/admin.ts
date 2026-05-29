import 'dotenv/config';
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  pgSchema,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
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
    weekNumber: integer('week_number').notNull(),
    year: integer('year').notNull(),
    seasonType: columnSeason('season_type').notNull(),
    completed: boolean('completed').notNull(),
    homeTeam: text('home_team').notNull(),
    awayTeam: text('away_team').notNull(),
    homePoints: integer('home_points'),
    awayPoints: integer('away_points'),
    winningTeam: columnTeam('winning_team').notNull().default('pending'),
    startTime: timestamp('start_time'),
    spread: real('spread'), // populated from CFBD lines; reserved for future "against the spread" mode — not used in current scoring or pick display
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.year, table.weekNumber],
      foreignColumns: [adminWeeks.year, adminWeeks.weekNumber],
      name: 'games_week_fk',
    }).onDelete('cascade'),
    index('games_year_week_idx').on(table.year, table.weekNumber),
    index('games_start_time_idx').on(table.startTime),
    unique('games_natural_key').on(table.year, table.weekNumber, table.homeTeam, table.awayTeam),
  ]
);

// ------------------------------------------------------------------
// ScoreCorrections – audit log of manual score overrides
// ------------------------------------------------------------------
export const scoreCorrections = adminSchema.table('score_corrections', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id')
    .notNull()
    .references(() => adminGames.gameId, { onDelete: 'cascade' }),
  correctedBy: integer('corrected_by').notNull(),
  correctedAt: timestamp('corrected_at').defaultNow().notNull(),
  oldHomePoints: integer('old_home_points'),
  oldAwayPoints: integer('old_away_points'),
  newHomePoints: integer('new_home_points').notNull(),
  newAwayPoints: integer('new_away_points').notNull(),
});

// ------------------------------------------------------------------
// Relation helpers
// ------------------------------------------------------------------
export const adminWeekRelations = relations(adminWeeks, ({ many }) => ({
  adminGames: many(adminGames),
}));

export const adminGameRelations = relations(adminGames, ({ one }) => ({
  adminWeeks: one(adminWeeks, {
    fields: [adminGames.year, adminGames.weekNumber],
    references: [adminWeeks.year, adminWeeks.weekNumber],
  }),
}));
