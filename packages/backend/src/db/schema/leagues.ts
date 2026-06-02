import { integer, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
// import { users } from './users'; // for drizzle-kit generate
import { adminGames } from './admin.js';
// import { adminGames } from './admin'; // for drizzle-kit generate

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

export const leagueChannels = pgTable('league_channels', {
  leagueId: integer('league_id')
    .primaryKey()
    .references(() => leagues.leagueId),
  ntfyTopicUrl: text('ntfy_topic_url'),
  telegramBotToken: text('telegram_bot_token'),
  telegramChatId: text('telegram_chat_id'),
  telegramInviteUrl: text('telegram_invite_url'),
  discordWebhookUrl: text('discord_webhook_url'),
  discordInviteUrl: text('discord_invite_url'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
