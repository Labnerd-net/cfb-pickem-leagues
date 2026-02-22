import 'dotenv/config';
import {
  foreignKey,
  integer,
  pgSchema,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { columnRole, columnTeam } from '../index.js';
// import { columnRole, columnTeam } from '../index'; // for drizzle-kit generate
import { adminGames } from '../schema/admin.js';
// import { adminGames } from '../schema/admin'; // for drizzle-kit generate

const userSchema = pgSchema('user');

// ------------------------------------------------------------------
// Users
// ------------------------------------------------------------------
export const users = userSchema.table('users', {
  userId: serial('user_id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  roles: columnRole('roles').array().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ------------------------------------------------------------------
// Games – picks only; join with admin.games for game metadata
// ------------------------------------------------------------------
export const games = userSchema.table(
  'games',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    gameId: integer('game_id').notNull(),
    teamChosen: columnTeam('team_chosen').notNull().default('pending'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => [
    primaryKey({ columns: [table.userId, table.gameId] }),
    foreignKey({
      columns: [table.gameId],
      foreignColumns: [adminGames.gameId],
      name: 'user_games_admin_games_fk',
    }).onDelete('cascade'),
  ]
);

// ------------------------------------------------------------------
// Deleted Users – audit log; populated before hard delete
// ------------------------------------------------------------------
export const deletedUsers = userSchema.table('deleted_users', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  roles: columnRole('roles').array().notNull(),
  createdAt: timestamp('created_at').notNull(),
  deletedAt: timestamp('deleted_at').defaultNow().notNull(),
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
