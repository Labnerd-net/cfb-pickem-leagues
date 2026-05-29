import { integer, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { adminGames } from './admin.js';

export const leagues = pgTable('leagues', {
  leagueId: serial('league_id').primaryKey(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.userId),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leagueMembers = pgTable(
  'league_members',
  {
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.leagueId),
    userId: integer('user_id')
      .notNull()
      .references(() => users.userId),
    role: text('role').notNull(), // 'admin' | 'member'
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  table => [primaryKey({ columns: [table.leagueId, table.userId] })]
);

export const leagueGames = pgTable(
  'league_games',
  {
    leagueId: integer('league_id')
      .notNull()
      .references(() => leagues.leagueId),
    gameId: integer('game_id')
      .notNull()
      .references(() => adminGames.gameId),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  table => [primaryKey({ columns: [table.leagueId, table.gameId] })]
);
