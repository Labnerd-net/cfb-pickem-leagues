import { describe, it, expect, vi } from 'vitest';
import { sql } from 'drizzle-orm';

vi.mock('../../../src/utils/envVars.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../src/utils/envVars.js')>()),
  demoMode: true,
}));

import { db } from '../../../src/db/index.js';
import { resetDemo } from '../../../src/demo/resetDemo.js';
import { buildDemoSeed, DEMO_USER_USER_ID } from '../../../src/demo/seedData.js';
import { users } from '../../../src/db/schema/users.js';
import { leagues } from '../../../src/db/schema/leagues.js';
import { makeGameData } from './fixtures.js';

async function counts() {
  const rows = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM "user".users)::int AS users,
      (SELECT COUNT(*) FROM public.leagues)::int AS leagues,
      (SELECT COUNT(*) FROM public.league_members)::int AS members,
      (SELECT COUNT(*) FROM public.league_games)::int AS league_games,
      (SELECT COUNT(*) FROM "admin".games)::int AS games,
      (SELECT COUNT(*) FROM "admin".weeks)::int AS weeks,
      (SELECT COUNT(*) FROM "user".games)::int AS picks,
      (SELECT COUNT(*) FROM "user".notification_log)::int AS logs
  `);
  return (rows as unknown as { rows: Record<string, number>[] }).rows[0];
}

describe('resetDemo', () => {
  const seed = buildDemoSeed(makeGameData());

  it('loads the seed, keeping the demo accounts on their fixed IDs', async () => {
    await resetDemo(seed);
    const c = await counts();
    expect(c.users).toBe(seed.users.length);
    expect(c.leagues).toBe(1);
    expect(c.members).toBe(seed.members.length);
    expect(c.league_games).toBe(seed.leagueGameIds.length);
    expect(c.games).toBe(seed.games.length);
    expect(c.weeks).toBe(seed.weeks.length);
    expect(c.picks).toBe(seed.picks.length);
    expect(c.logs).toBe(seed.notificationLog.length);
    const demoUser = await db.select().from(users).where(sql`${users.userId} = ${DEMO_USER_USER_ID}`);
    expect(demoUser[0].email).toBe('demo-user@demo.invalid');
  });

  it('restores the seeded state after visitor changes, and is safe to run repeatedly', async () => {
    await resetDemo(seed);
    const before = await counts();

    // Simulate visitor activity: a new league, extra rows, deleted picks.
    const [extra] = await db
      .insert(leagues)
      .values({ name: 'Visitor League', inviteCode: 'visitor1', createdBy: DEMO_USER_USER_ID })
      .returning();
    expect(extra.leagueId).toBeGreaterThan(seed.league.leagueId); // sequence moved past seeded IDs
    await db.execute(sql`DELETE FROM "user".games WHERE user_id = ${DEMO_USER_USER_ID}`);
    await db.execute(sql`UPDATE "admin".games SET home_points = 99 WHERE game_id = 1`);
    await db.execute(
      sql`INSERT INTO "admin".score_corrections (game_id, corrected_by, new_home_points, new_away_points) VALUES (1, 1, 99, 0)`
    );

    await resetDemo(seed);
    await resetDemo(seed);
    expect(await counts()).toEqual(before);
    const corrections = await db.execute(sql`SELECT COUNT(*)::int AS n FROM "admin".score_corrections`);
    expect((corrections as unknown as { rows: { n: number }[] }).rows[0].n).toBe(0);
  });

  it('new rows after a reset do not collide with seeded IDs', async () => {
    await resetDemo(seed);
    const [u] = await db
      .insert(users)
      .values({ email: 'new@example.com', displayName: 'New', passwordHash: 'x', roles: ['user'] })
      .returning();
    expect(u.userId).toBe(seed.users.length + 1);
  });
});
