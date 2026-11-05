import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adminWeeks, adminGames, scoreCorrections } from '../db/schema/admin.js';
import {
  users,
  games as userGames,
  notificationLog,
  notificationPreferences,
  deletedUsers,
} from '../db/schema/users.js';
import { leagues, leagueMembers, leagueGames, leagueChannels } from '../db/schema/leagues.js';
import { demoMode } from '../utils/envVars.js';
import type { DemoSeed } from './seedData.js';

/**
 * Wipes every table and reinserts the demo seed. DESTRUCTIVE — it deletes all data in the
 * connected database, so it refuses to run unless DEMO_MODE is on (which only the isolated
 * demo Worker / an explicitly configured local script sets).
 *
 * The neon-http driver has no interactive transactions and every statement is a separate
 * HTTP request (Workers cap subrequests per invocation), so the whole wipe-and-insert is a
 * single db.batch(): one request, one transaction. All rows carry explicit IDs so the demo
 * accounts keep the same user IDs across resets (a visitor's JWT stays valid). Serial
 * sequences are advanced past the seeded IDs in a second, idempotent statement.
 */
export async function resetDemo(seed: DemoSeed): Promise<void> {
  if (!demoMode) {
    throw new Error('resetDemo refused: DEMO_MODE is not enabled');
  }

  // Delete in FK-safe order (children first).
  const queries = [
    db.delete(notificationLog),
    db.delete(notificationPreferences),
    db.delete(userGames),
    db.delete(leagueChannels),
    db.delete(leagueGames),
    db.delete(leagueMembers),
    db.delete(leagues),
    db.delete(scoreCorrections),
    db.delete(adminGames),
    db.delete(adminWeeks),
    db.delete(deletedUsers),
    db.delete(users),

    // Insert in FK-safe order (parents first).
    db.insert(adminWeeks).values(seed.weeks),
    db.insert(adminGames).values(seed.games),
    db.insert(users).values(seed.users),
    db.insert(leagues).values(seed.league),
    db.insert(leagueMembers).values(seed.members),
    db.insert(leagueGames).values(seed.leagueGameIds.map(gameId => ({ leagueId: seed.league.leagueId, gameId }))),
    db.insert(userGames).values(seed.picks),
    db.insert(notificationLog).values(seed.notificationLog),
  ];

  await db.batch(queries as [(typeof queries)[number], ...(typeof queries)[number][]]);

  // Move each serial sequence past the explicitly-inserted IDs so normal inserts (a visitor
  // creating a league, the admin correcting a score) never collide with seeded rows.
  await db.execute(sql`
    SELECT
      setval(pg_get_serial_sequence('"user".users', 'user_id'),
             GREATEST((SELECT COALESCE(MAX(user_id), 0) FROM "user".users), 1),
             (SELECT COUNT(*) > 0 FROM "user".users)),
      setval(pg_get_serial_sequence('"admin".games', 'game_id'),
             GREATEST((SELECT COALESCE(MAX(game_id), 0) FROM "admin".games), 1),
             (SELECT COUNT(*) > 0 FROM "admin".games)),
      setval(pg_get_serial_sequence('public.leagues', 'league_id'),
             GREATEST((SELECT COALESCE(MAX(league_id), 0) FROM public.leagues), 1),
             (SELECT COUNT(*) > 0 FROM public.leagues)),
      setval(pg_get_serial_sequence('"user".notification_log', 'id'),
             GREATEST((SELECT COALESCE(MAX(id), 0) FROM "user".notification_log), 1),
             (SELECT COUNT(*) > 0 FROM "user".notification_log)),
      setval(pg_get_serial_sequence('"admin".score_corrections', 'id'), 1, false)
  `);
}
