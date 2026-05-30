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

// ---------------------------------------------------------------------------
// POST /api/admin/leagues/:leagueId/games/complete
// ---------------------------------------------------------------------------
describe('POST /api/admin/leagues/:leagueId/games/complete', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/admin/leagues/1/games/complete?year=2024&weekNumber=1', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('returns 422 if no games are in the league pool for the week', async () => {
    const token = await makeAdminToken();
    const res = await app.request('/api/admin/leagues/1/games/complete?year=2024&weekNumber=1', {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(422);
  });

  it('marks all scored games as complete and returns count', async () => {
    const game1 = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    const game2 = await createTestGame(1, 2024, 'Ohio State', 'Michigan');
    await createLeagueGame(1, game1.game_id as number);
    await createLeagueGame(1, game2.game_id as number);

    // Set scores so both games can be marked complete
    await testDb.execute(sql`UPDATE "admin"."games" SET home_points = 28, away_points = 21 WHERE game_id = ${game1.game_id as number}`);
    await testDb.execute(sql`UPDATE "admin"."games" SET home_points = 31, away_points = 24 WHERE game_id = ${game2.game_id as number}`);

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/leagues/1/games/complete?year=2024&weekNumber=1', {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { completed: number };
    expect(body.completed).toBe(2);

    const rows = await testDb.execute(sql`SELECT completed FROM "admin"."games" WHERE game_id IN (${game1.game_id as number}, ${game2.game_id as number})`);
    expect(rows.rows.every((r: Record<string, unknown>) => r.completed === true)).toBe(true);
  });

  it('skips games without scores', async () => {
    const game1 = await createTestGame(1, 2024, 'Alabama', 'Georgia'); // no scores
    const game2 = await createTestGame(1, 2024, 'Ohio State', 'Michigan');
    await createLeagueGame(1, game1.game_id as number);
    await createLeagueGame(1, game2.game_id as number);
    await testDb.execute(sql`UPDATE "admin"."games" SET home_points = 31, away_points = 24 WHERE game_id = ${game2.game_id as number}`);

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/leagues/1/games/complete?year=2024&weekNumber=1', {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { completed: number };
    expect(body.completed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/leagues/:leagueId/games/:gameId/score
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/leagues/:leagueId/games/:gameId/score', () => {
  it('returns 401 without auth', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}/score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homePoints: 28, awayPoints: 21 }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for league member (non-admin)', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    await createLeagueGame(1, game.game_id as number);
    const token = await makeMemberToken();
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}/score`, {
      method: 'PATCH',
      headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ homePoints: 28, awayPoints: 21 }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 for negative scores', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    await createLeagueGame(1, game.game_id as number);
    const token = await makeAdminToken();
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}/score`, {
      method: 'PATCH',
      headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ homePoints: -1, awayPoints: 21 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown gameId', async () => {
    const token = await makeAdminToken();
    const res = await app.request('/api/admin/leagues/1/games/999999/score?year=2024&weekNumber=1', {
      method: 'PATCH',
      headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ homePoints: 28, awayPoints: 21 }),
    });
    expect(res.status).toBe(404);
  });

  it('corrects score and updates winningTeam globally', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia');
    await createLeagueGame(1, game.game_id as number);
    const token = await makeAdminToken();
    const res = await app.request(`/api/admin/leagues/1/games/${game.game_id as number}/score?year=2024&weekNumber=1`, {
      method: 'PATCH',
      headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ homePoints: 28, awayPoints: 21 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { game: { homePoints: number; awayPoints: number; winningTeam: string; completed: boolean } };
    expect(body.game.homePoints).toBe(28);
    expect(body.game.awayPoints).toBe(21);
    expect(body.game.winningTeam).toBe('home_team');
    expect(body.game.completed).toBe(true);
  });

  it('writes an audit row to score_corrections', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true);
    await createLeagueGame(1, game.game_id as number);
    await testDb.execute(sql`UPDATE "admin"."games" SET home_points = 14, away_points = 7 WHERE game_id = ${game.game_id as number}`);

    const token = await makeAdminToken();
    await app.request(`/api/admin/leagues/1/games/${game.game_id as number}/score?year=2024&weekNumber=1`, {
      method: 'PATCH',
      headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ homePoints: 28, awayPoints: 21 }),
    });

    const rows = await testDb.execute(sql`SELECT * FROM "admin"."score_corrections" WHERE game_id = ${game.game_id as number}`);
    expect(rows.rows).toHaveLength(1);
    const row = rows.rows[0] as Record<string, unknown>;
    expect(row.old_home_points).toBe(14);
    expect(row.new_home_points).toBe(28);
    expect(row.corrected_by).toBe(1);
  });
});
