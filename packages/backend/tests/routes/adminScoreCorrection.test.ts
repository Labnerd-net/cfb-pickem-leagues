import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { sql } from 'drizzle-orm';
import { seedTestData, cleanDatabase, createTestGame, testDb } from '../db-utils.js';

vi.mock('../../src/notifications/dispatcher.js', () => ({
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
}));

import { dispatchNotification } from '../../src/notifications/dispatcher.js';
import adminRoutes from '../../src/routes/admin.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/admin', adminRoutes);
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  return c.json({ error: 'An unexpected error occurred' }, 500);
});

async function makeAdminToken(sub = 1) {
  return sign(
    {
      sub,
      email: 'admin@test.com',
      displayName: 'Test Admin',
      roles: ['admin', 'user'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    TEST_JWT_SECRET,
    'HS256'
  );
}

async function makeUserToken() {
  return sign(
    {
      sub: 2,
      email: 'user@test.com',
      displayName: 'Test User',
      roles: ['user'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    TEST_JWT_SECRET,
    'HS256'
  );
}

function correctRequest(gameId: number, homePoints: number, awayPoints: number, token: string) {
  return app.request(`/api/admin/games/${gameId}/score`, {
    method: 'PATCH',
    headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ homePoints, awayPoints }),
  });
}

describe('PATCH /api/admin/games/:gameId/score', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await seedTestData();
    vi.mocked(dispatchNotification).mockClear();
  });

  it('returns 401 without auth token', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true);
    const res = await app.request(`/api/admin/games/${game.game_id}/score`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homePoints: 28, awayPoints: 21 }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true);
    const token = await makeUserToken();
    const res = await correctRequest(game.game_id as number, 28, 21, token);
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown gameId', async () => {
    const token = await makeAdminToken();
    const res = await correctRequest(999999, 28, 21, token);
    expect(res.status).toBe(404);
  });

  it('returns 400 for negative scores', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true);
    const token = await makeAdminToken();
    const res = await correctRequest(game.game_id as number, -1, 21, token);
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-integer scores', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true);
    const token = await makeAdminToken();
    const res = await app.request(`/api/admin/games/${game.game_id}/score`, {
      method: 'PATCH',
      headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ homePoints: 28.5, awayPoints: 21 }),
    });
    expect(res.status).toBe(400);
  });

  it('updates game row with correct scores and winningTeam', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true);
    const token = await makeAdminToken();
    const res = await correctRequest(game.game_id as number, 28, 21, token);

    expect(res.status).toBe(200);
    const body = await res.json() as { game: { homePoints: number; awayPoints: number; winningTeam: string; completed: boolean } };
    expect(body.game.homePoints).toBe(28);
    expect(body.game.awayPoints).toBe(21);
    expect(body.game.winningTeam).toBe('home_team');
    expect(body.game.completed).toBe(true);
  });

  it('sets winningTeam to away_team when away wins', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true);
    const token = await makeAdminToken();
    const res = await correctRequest(game.game_id as number, 14, 35, token);

    expect(res.status).toBe(200);
    const body = await res.json() as { game: { winningTeam: string } };
    expect(body.game.winningTeam).toBe('away_team');
  });

  it('sets winningTeam to pending on a tie', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true);
    const token = await makeAdminToken();
    const res = await correctRequest(game.game_id as number, 21, 21, token);

    expect(res.status).toBe(200);
    const body = await res.json() as { game: { winningTeam: string } };
    expect(body.game.winningTeam).toBe('pending');
  });

  it('inserts an audit row in score_corrections with before/after values', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true, true);

    // Manually set initial scores so we have a "before" value
    await testDb.execute(sql`
      UPDATE "admin"."games"
      SET home_points = 14, away_points = 7, winning_team = 'home_team'
      WHERE game_id = ${game.game_id as number}
    `);

    const token = await makeAdminToken();
    await correctRequest(game.game_id as number, 28, 21, token);

    const rows = await testDb.execute(sql`
      SELECT * FROM "admin"."score_corrections"
      WHERE game_id = ${game.game_id as number}
    `);
    expect(rows.rows.length).toBe(1);
    const row = rows.rows[0] as Record<string, unknown>;
    expect(row.old_home_points).toBe(14);
    expect(row.old_away_points).toBe(7);
    expect(row.new_home_points).toBe(28);
    expect(row.new_away_points).toBe(21);
    expect(row.corrected_by).toBe(1);
  });

  it('works on a game with no prior score (completed: false)', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true, false);
    const token = await makeAdminToken();
    const res = await correctRequest(game.game_id as number, 28, 21, token);

    expect(res.status).toBe(200);
    const body = await res.json() as { game: { completed: boolean; homePoints: number } };
    expect(body.game.completed).toBe(true);
    expect(body.game.homePoints).toBe(28);
  });

  it('dispatches rankings_updated when all picked games for the week are complete', async () => {
    const game = await createTestGame(1, 2024, 'Alabama', 'Georgia', true, false);
    const token = await makeAdminToken();
    await correctRequest(game.game_id as number, 28, 21, token);

    expect(dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ notificationType: 'rankings_updated' })
    );
  });

  it('does not dispatch rankings_updated when other picked games are still incomplete', async () => {
    await createTestGame(1, 2024, 'Alabama', 'Georgia', true, false);
    const game2 = await createTestGame(1, 2024, 'Ohio State', 'Michigan', true, false);
    const token = await makeAdminToken();
    await correctRequest(game2.game_id as number, 28, 21, token);

    expect(dispatchNotification).not.toHaveBeenCalled();
  });
});
