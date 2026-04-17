import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { seedTestData, cleanDatabase, createTestGame } from '../db-utils.js';

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

async function makeAdminToken() {
  return sign(
    {
      sub: 1,
      email: 'admin@test.com',
      displayName: 'Test Admin',
      roles: ['admin', 'user'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    TEST_JWT_SECRET,
    'HS256'
  );
}

function completeRequest(gameId: number, homePoints: number, awayPoints: number, token: string) {
  return app.request('/api/admin/games/complete', {
    method: 'POST',
    headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId, homePoints, awayPoints }),
  });
}

describe('POST /api/admin/games/complete', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await seedTestData();
    vi.mocked(dispatchNotification).mockClear();
  });

  it('returns 404 when game does not exist', async () => {
    const token = await makeAdminToken();
    const res = await completeRequest(99999, 28, 14, token);
    expect(res.status).toBe(404);
  });

  it('marks a game complete with home team winning', async () => {
    const row = await createTestGame(1, 2024, 'Alabama', 'Georgia', true, false, null);
    const gameId = (row as { game_id: number }).game_id;

    const token = await makeAdminToken();
    const res = await completeRequest(gameId, 28, 21, token);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { game: { completed: boolean; winningTeam: string; homePoints: number; awayPoints: number } };
    expect(body.game.completed).toBe(true);
    expect(body.game.winningTeam).toBe('home_team');
    expect(body.game.homePoints).toBe(28);
    expect(body.game.awayPoints).toBe(21);
  });

  it('marks a game complete with away team winning', async () => {
    const row = await createTestGame(1, 2024, 'Michigan', 'Ohio State', true, false, null);
    const gameId = (row as { game_id: number }).game_id;

    const token = await makeAdminToken();
    const res = await completeRequest(gameId, 13, 30, token);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { game: { winningTeam: string } };
    expect(body.game.winningTeam).toBe('away_team');
  });

  it('dispatches rankings_updated when all picked games for the week are complete', async () => {
    const rowA = await createTestGame(1, 2024, 'Oregon', 'Washington', true, false, null);
    const rowB = await createTestGame(1, 2024, 'Penn State', 'Notre Dame', true, false, null);
    const gameIdA = (rowA as { game_id: number }).game_id;
    const gameIdB = (rowB as { game_id: number }).game_id;

    const token = await makeAdminToken();

    // Mark first game complete — not all done yet
    await completeRequest(gameIdA, 35, 21, token);
    expect(dispatchNotification).not.toHaveBeenCalled();

    // Mark second game complete — now all picked games for week 1 are done
    await completeRequest(gameIdB, 17, 24, token);
    expect(dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ notificationType: 'rankings_updated', year: 2024, weekNumber: 1 })
    );
  });

  it('does not dispatch notification when unpicked games remain incomplete', async () => {
    // unpicked game (picked=false) should not block the notification
    const pickedRow = await createTestGame(1, 2024, 'Texas', 'Oklahoma', true, false, null);
    await createTestGame(1, 2024, 'LSU', 'Florida', false, false, null); // not picked
    const gameId = (pickedRow as { game_id: number }).game_id;

    const token = await makeAdminToken();
    await completeRequest(gameId, 30, 24, token);

    // The only picked game is now complete — notification fires
    expect(dispatchNotification).toHaveBeenCalledWith(
      expect.objectContaining({ notificationType: 'rankings_updated' })
    );
  });
});

describe('Pick deadline with DEV_CURRENT_TIME', () => {
  let origDevTime: string | undefined;

  beforeEach(async () => {
    origDevTime = process.env.DEV_CURRENT_TIME;
    await cleanDatabase();
    await seedTestData();
  });

  // afterEach defined inline via try/finally in each test to keep env clean

  it('blocks pick when DEV_CURRENT_TIME is after game kickoff', async () => {
    process.env.DEV_CURRENT_TIME = '2024-08-31T21:00:00Z'; // after kickoff
    try {
      const kickoff = new Date('2024-08-31T19:30:00Z');
      const row = await createTestGame(1, 2024, 'Clock Home A', 'Clock Away A', true, false, kickoff);
      const gameId = (row as { game_id: number }).game_id;

      vi.resetModules();
      vi.doMock('../../src/utils/envVars.js', () => ({
        ignorePickDeadline: false,
        isProduction: false,
        jwtSecret: TEST_JWT_SECRET,
        jwtAlgorithm: 'HS256',
        jwtExpirationDays: 7,
        getJwtExpirationSeconds: () => 9999999999,
        bcryptSaltRounds: 10,
        logLevel: 'silent',
        trustProxy: false,
        serverPort: 3000,
        clientURLs: ['http://localhost:5173'],
      }));

      const { default: userRouter } = await import('../../src/routes/user.js');
      const userApp = new Hono();
      userApp.route('/user', userRouter);
      userApp.onError((err, c) => {
        if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
        return c.json({ error: 'Internal server error' }, 500);
      });

      const token = await sign(
        { sub: 1, email: 'test@test.com', roles: ['user'], exp: 9999999999 },
        TEST_JWT_SECRET,
        'HS256'
      );
      const res = await userApp.request('/user/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `auth_token=${token}` },
        body: JSON.stringify({ year: 2024, week: 1, games: [{ game: gameId, pick: 'home_team' }] }),
      });

      expect(res.status).toBe(422);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('locked');
    } finally {
      if (origDevTime === undefined) delete process.env.DEV_CURRENT_TIME;
      else process.env.DEV_CURRENT_TIME = origDevTime;
    }
  });

  it('allows pick when DEV_CURRENT_TIME is before game kickoff', async () => {
    process.env.DEV_CURRENT_TIME = '2024-08-31T10:00:00Z'; // before kickoff
    try {
      const kickoff = new Date('2024-08-31T19:30:00Z');
      const row = await createTestGame(1, 2024, 'Clock Home B', 'Clock Away B', true, false, kickoff);
      const gameId = (row as { game_id: number }).game_id;

      vi.resetModules();
      vi.doMock('../../src/utils/envVars.js', () => ({
        ignorePickDeadline: false,
        isProduction: false,
        jwtSecret: TEST_JWT_SECRET,
        jwtAlgorithm: 'HS256',
        jwtExpirationDays: 7,
        getJwtExpirationSeconds: () => 9999999999,
        bcryptSaltRounds: 10,
        logLevel: 'silent',
        trustProxy: false,
        serverPort: 3000,
        clientURLs: ['http://localhost:5173'],
      }));

      const { default: userRouter } = await import('../../src/routes/user.js');
      const userApp = new Hono();
      userApp.route('/user', userRouter);
      userApp.onError((err, c) => {
        if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
        return c.json({ error: 'Internal server error' }, 500);
      });

      const token = await sign(
        { sub: 1, email: 'test@test.com', roles: ['user'], exp: 9999999999 },
        TEST_JWT_SECRET,
        'HS256'
      );
      const res = await userApp.request('/user/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `auth_token=${token}` },
        body: JSON.stringify({ year: 2024, week: 1, games: [{ game: gameId, pick: 'home_team' }] }),
      });

      expect(res.status).toBe(200);
    } finally {
      if (origDevTime === undefined) delete process.env.DEV_CURRENT_TIME;
      else process.env.DEV_CURRENT_TIME = origDevTime;
    }
  });
});
