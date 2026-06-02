import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { sql } from 'drizzle-orm';
import {
  seedTestData,
  cleanDatabase,
  createTestGame,
  createLeagueGame,
  createTestPick,
  testDb,
} from '../db-utils.js';
import adminLeaguesRoute from '../../src/routes/adminLeagues.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/admin/leagues', adminLeaguesRoute);
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  return c.json({ error: 'An unexpected error occurred' }, 500);
});

async function makeAdminToken(sub = 1) {
  return sign(
    { sub, email: 'admin@test.com', displayName: 'Test Admin', roles: ['admin', 'user'], exp: Math.floor(Date.now() / 1000) + 3600 },
    TEST_JWT_SECRET,
    'HS256',
  );
}

async function makeMemberToken() {
  return sign(
    { sub: 2, email: 'user@test.com', displayName: 'Test User', roles: ['user'], exp: Math.floor(Date.now() / 1000) + 3600 },
    TEST_JWT_SECRET,
    'HS256',
  );
}

beforeEach(async () => {
  await cleanDatabase();
  await seedTestData();
});

// ---------------------------------------------------------------------------
// GET /api/admin/leagues/:leagueId/games
// ---------------------------------------------------------------------------
describe('GET /api/admin/leagues/:leagueId/games', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/admin/leagues/1/games?year=2024&weekNumber=1');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown league', async () => {
    const token = await makeAdminToken();
    const res = await app.request('/api/admin/leagues/9999/games?year=2024&weekNumber=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(404);
  });

  it('returns 403 for league member who is not league admin', async () => {
    const token = await makeMemberToken();
    const res = await app.request('/api/admin/leagues/1/games?year=2024&weekNumber=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns games annotated with inLeague status', async () => {
    const game1 = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    const game2 = await createTestGame(1, 2024, 'Ohio State', 'Michigan');
    await createLeagueGame(1, game1.game_id as number);

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/leagues/1/games?year=2024&weekNumber=1', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { games: { gameId: number; inLeague: boolean }[] };
    expect(body.games).toHaveLength(2);

    const g1 = body.games.find(g => g.gameId === game1.game_id);
    const g2 = body.games.find(g => g.gameId === game2.game_id);
    expect(g1?.inLeague).toBe(true);
    expect(g2?.inLeague).toBe(false);
  });

  it('returns empty array for week with no games', async () => {
    const token = await makeAdminToken();
    const res = await app.request('/api/admin/leagues/1/games?year=2024&weekNumber=2', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { games: unknown[] };
    expect(body.games).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/leagues/:leagueId/games/:gameId
// ---------------------------------------------------------------------------
describe('POST /api/admin/leagues/:leagueId/games/:gameId', () => {
  it('returns 401 without auth', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for league member (non-admin)', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    const token = await makeMemberToken();
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}`, {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(403);
  });

  it('adds a game to the league pool and returns 201', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    const token = await makeAdminToken();
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}`, {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);

    const rows = await testDb.execute(sql`SELECT * FROM league_games WHERE league_id = 1 AND game_id = ${game.game_id as number}`);
    expect(rows.rows).toHaveLength(1);
  });

  it('returns 409 if game is already in the league pool', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    await createLeagueGame(1, game.game_id as number);

    const token = await makeAdminToken();
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}`, {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(409);
  });

  it('returns 404 if gameId does not exist in global cache', async () => {
    const token = await makeAdminToken();
    const res = await app.request('/api/admin/leagues/1/games/999999', {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/leagues/:leagueId/games/:gameId
// ---------------------------------------------------------------------------
describe('DELETE /api/admin/leagues/:leagueId/games/:gameId', () => {
  it('returns 401 without auth', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    await createLeagueGame(1, game.game_id as number);
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });

  it('removes a game from the league pool', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    await createLeagueGame(1, game.game_id as number);

    const token = await makeAdminToken();
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}`, {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);

    const rows = await testDb.execute(sql`SELECT * FROM league_games WHERE league_id = 1 AND game_id = ${game.game_id as number}`);
    expect(rows.rows).toHaveLength(0);
  });

  it('returns 409 if any user has a pick on the game', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    await createLeagueGame(1, game.game_id as number);
    await createTestPick(2, game.game_id as number, 1);

    const token = await makeAdminToken();
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}`, {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(409);
  });
});

