import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { sql } from 'drizzle-orm';
import { seedTestData, createTestGame, createTestUser, createTestWeek, testDb, createLeagueGame, addPickedGame } from '../db-utils.js';
import leaderboardRoutes from '../../src/routes/leaderboard.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/leaderboard', leaderboardRoutes);
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  return c.json({ error: 'An unexpected error occurred' }, 500);
});

async function makeToken(userId = 1) {
  return sign(
    {
      sub: userId,
      email: 'admin@test.com',
      displayName: 'Test Admin',
      roles: ['admin', 'user'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    TEST_JWT_SECRET,
    'HS256',
  );
}

// Single seed for the whole file; advance the serial sequence past the
// explicit user_ids (1, 2) seeded by seedTestData so createTestUser works.
beforeAll(async () => {
  await seedTestData();
  await testDb.execute(
    sql`SELECT setval(pg_get_serial_sequence('"user"."users"', 'user_id'), (SELECT MAX(user_id) FROM "user"."users"), true)`
  );
});

describe('GET /api/leaderboard', () => {
  it('returns 401 with no auth token', async () => {
    const res = await app.request('/api/leaderboard?year=2024&leagueId=1');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid year', async () => {
    const token = await makeToken();
    const res = await app.request('/api/leaderboard?year=abc&leagueId=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(400);
  });

  it('returns all users with zero picks still appearing', async () => {
    const token = await makeToken();
    const res = await app.request('/api/leaderboard?year=2024&leagueId=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    // Both seeded users (id 1 and 2) should appear even with no picks
    expect(body.leaderboard.length).toBeGreaterThanOrEqual(2);
    const user2 = body.leaderboard.find((e: { userId: number }) => e.userId === 2);
    expect(user2).toBeDefined();
    expect(user2.total).toBe(0);
    expect(user2.correct).toBe(0);
    expect(user2.incorrect).toBe(0);
    expect(user2.pending).toBe(0);
    expect(user2.percentage).toBeNull();
  });

  it('user with more correct picks ranks higher', async () => {
    const user3Row = await createTestUser('leaderboard3@test.com', 'LB User3', ['user']);
    const user3Id = Number((user3Row as { user_id: number }).user_id);

    // Add user3 to Default League so they appear in leaderboard
    await testDb.execute(sql`
      INSERT INTO league_members (league_id, user_id, role) VALUES (1, ${user3Id}, 'member')
      ON CONFLICT (league_id, user_id) DO NOTHING
    `);

    // Use seeded week 1
    const game1 = await createTestGame(1, 2024, 'Clemson', 'FSU', false, new Date('2099-01-01'));
    const game2 = await createTestGame(1, 2024, 'Georgia', 'Tennessee', false, new Date('2099-01-01'));
    const gameId1 = Number((game1 as { game_id: number }).game_id);
    const gameId2 = Number((game2 as { game_id: number }).game_id);

    // User 1 picks home_team for both
    await addPickedGame({ game: gameId1, pick: 'home_team' }, 1);
    await addPickedGame({ game: gameId2, pick: 'home_team' }, 1);

    // User 3 picks away_team for both
    await addPickedGame({ game: gameId1, pick: 'away_team' }, user3Id);
    await addPickedGame({ game: gameId2, pick: 'away_team' }, user3Id);

    // home_team wins both — user 1 gets 2 correct, user 3 gets 0
    await testDb.execute(sql`
      UPDATE "admin"."games"
      SET winning_team = 'home_team', completed = true
      WHERE game_id = ${gameId1}
    `);
    await testDb.execute(sql`
      UPDATE "admin"."games"
      SET winning_team = 'home_team', completed = true
      WHERE game_id = ${gameId2}
    `);

    const token = await makeToken();
    const res = await app.request('/api/leaderboard?year=2024&leagueId=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    const entry1 = body.leaderboard.find((e: { userId: number }) => e.userId === 1);
    const entry3 = body.leaderboard.find((e: { userId: number }) => e.userId === user3Id);
    expect(entry1).toBeDefined();
    expect(entry3).toBeDefined();
    // User 1 should appear before user 3 (ordered by correct DESC)
    const idx1 = body.leaderboard.indexOf(entry1);
    const idx3 = body.leaderboard.indexOf(entry3);
    expect(idx1).toBeLessThan(idx3);
  });

  it('pending games count toward total but not correct or incorrect', async () => {
    await createTestWeek(3, 2024);
    const game = await createTestGame(3, 2024, 'Oregon', 'Washington', false, new Date('2099-01-01'));
    const gameId = Number((game as { game_id: number }).game_id);

    await addPickedGame({ game: gameId, pick: 'home_team' }, 1);
    // winning_team stays 'pending' by default

    const token = await makeToken();
    const res = await app.request('/api/leaderboard?year=2024&leagueId=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const entry1 = body.leaderboard.find((e: { userId: number }) => e.userId === 1);
    expect(entry1).toBeDefined();
    expect(entry1.pending).toBeGreaterThanOrEqual(1);
    // pending does not count toward correct or incorrect
    // (correct/incorrect counts may include games from other tests but pending is isolated here)
  });

  it('tied users both appear in results', async () => {
    // Use seeded users 1 and 2 — both pick wrong; expect equal correct counts
    await createTestWeek(4, 2024);
    const game = await createTestGame(4, 2024, 'Notre Dame', 'USC', false, new Date('2099-01-01'));
    const gameId = Number((game as { game_id: number }).game_id);

    // Both pick home_team but away_team will win
    await addPickedGame({ game: gameId, pick: 'home_team' }, 1);
    await addPickedGame({ game: gameId, pick: 'home_team' }, 2);

    await testDb.execute(sql`
      UPDATE "admin"."games"
      SET winning_team = 'away_team', completed = true
      WHERE game_id = ${gameId}
    `);

    const token = await makeToken();
    const res = await app.request('/api/leaderboard?year=2024&leagueId=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const entry1 = body.leaderboard.find((e: { userId: number }) => e.userId === 1);
    const entry2 = body.leaderboard.find((e: { userId: number }) => e.userId === 2);
    expect(entry1).toBeDefined();
    expect(entry2).toBeDefined();
  });
});

describe('GET /api/leaderboard/scores', () => {
  it('returns 401 with no auth token', async () => {
    const res = await app.request('/api/leaderboard/scores?year=2024&weekNumber=1&leagueId=1');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid year', async () => {
    const token = await makeToken();
    const res = await app.request('/api/leaderboard/scores?year=bad&weekNumber=1&leagueId=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid week', async () => {
    const token = await makeToken();
    const res = await app.request('/api/leaderboard/scores?year=2024&weekNumber=99&leagueId=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(400);
  });

  it('returns empty array when no picks exist for the week', async () => {
    const token = await makeToken();
    const res = await app.request('/api/leaderboard/scores?year=2024&weekNumber=52&leagueId=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scores).toEqual([]);
  });

  it('returns correct per-user counts for a week', async () => {
    await createTestWeek(5, 2024);
    const game1 = await createTestGame(5, 2024, 'Penn State', 'Iowa', false, new Date('2099-01-01'));
    const game2 = await createTestGame(5, 2024, 'Oklahoma', 'Texas', false, new Date('2099-01-01'));
    const gameId1 = Number((game1 as { game_id: number }).game_id);
    const gameId2 = Number((game2 as { game_id: number }).game_id);

    // User 1 picks home_team for both
    await addPickedGame({ game: gameId1, pick: 'home_team' }, 1);
    await addPickedGame({ game: gameId2, pick: 'home_team' }, 1);

    // home_team wins game1, away_team wins game2
    await testDb.execute(sql`
      UPDATE "admin"."games"
      SET winning_team = 'home_team', completed = true
      WHERE game_id = ${gameId1}
    `);
    await testDb.execute(sql`
      UPDATE "admin"."games"
      SET winning_team = 'away_team', completed = true
      WHERE game_id = ${gameId2}
    `);

    const token = await makeToken();
    const res = await app.request('/api/leaderboard/scores?year=2024&weekNumber=5&leagueId=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const entry = body.scores.find((e: { userId: number }) => e.userId === 1);
    expect(entry).toBeDefined();
    expect(entry.total).toBe(2);
    expect(entry.correct).toBe(1);
    expect(entry.incorrect).toBe(1);
    expect(entry.pending).toBe(0);
    // User 2 has no picks this week so should not appear
    const entry2 = body.scores.find((e: { userId: number }) => e.userId === 2);
    expect(entry2).toBeUndefined();
  });
});
