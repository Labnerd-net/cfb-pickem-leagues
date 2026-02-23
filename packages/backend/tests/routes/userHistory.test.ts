import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { sql } from 'drizzle-orm';
import { seedTestData, createTestGame, testDb } from '../db-utils.js';
import { addPickedGame } from '../../src/db/dbUserFunctions.js';
import userRoutes from '../../src/routes/user.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/user', userRoutes);
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

describe('GET /api/user/history', () => {
  beforeAll(async () => {
    await seedTestData();
  });

  it('returns empty history for a user with no picks', async () => {
    // user 2 has no picks seeded
    const token = await makeToken(2);
    const res = await app.request('/api/user/history?year=2024', {
      headers: { Cookie: `auth_token=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.history).toEqual([]);
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await app.request('/api/user/history?year=2024');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid year', async () => {
    const token = await makeToken();
    const res = await app.request('/api/user/history?year=abc', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(400);
  });

  it('returns correct/incorrect counts for completed games', async () => {
    // Create two games in week 1
    const game1 = await createTestGame(1, 2024, 'Alabama', 'Auburn', true, false, new Date('2099-01-01'));
    const game2 = await createTestGame(1, 2024, 'Ohio State', 'Michigan', true, false, new Date('2099-01-01'));
    const gameId1 = Number((game1 as { game_id: number }).game_id);
    const gameId2 = Number((game2 as { game_id: number }).game_id);

    // User picks home_team for both
    await addPickedGame({ game: gameId1, pick: 'home_team' }, '1');
    await addPickedGame({ game: gameId2, pick: 'home_team' }, '1');

    // Set game1 winner to home_team (correct), game2 to away_team (incorrect)
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

    const token = await makeToken(1);
    const res = await app.request('/api/user/history?year=2024', {
      headers: { Cookie: `auth_token=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const week1 = body.history.find((e: { weekNumber: number }) => e.weekNumber === 1);
    expect(week1).toBeDefined();
    expect(week1.correct).toBe(1);
    expect(week1.incorrect).toBe(1);
    expect(week1.pending).toBe(0);
    expect(week1.total).toBe(2);
  });

  it('returns correct pending count for unfinished games', async () => {
    // Create a game in week 2 that stays pending
    const game = await createTestGame(2, 2024, 'LSU', 'Texas', true, false, new Date('2099-01-01'));
    const gameId = Number((game as { game_id: number }).game_id);

    await addPickedGame({ game: gameId, pick: 'home_team' }, '1');
    // winning_team stays 'pending' (default)

    const token = await makeToken(1);
    const res = await app.request('/api/user/history?year=2024', {
      headers: { Cookie: `auth_token=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const week2 = body.history.find((e: { weekNumber: number }) => e.weekNumber === 2);
    expect(week2).toBeDefined();
    expect(week2.pending).toBe(1);
    expect(week2.correct).toBe(0);
    expect(week2.incorrect).toBe(0);
    expect(week2.total).toBe(1);
  });
});
