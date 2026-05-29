import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { sql } from 'drizzle-orm';
import { seedTestData, createTestGame, testDb } from '../db-utils.js';
import adminRoutes from '../../src/routes/admin.js';

vi.mock('../../src/api/index.js', () => ({
  getWeekData: vi.fn(),
  getGameData: vi.fn(),
}));

import { getGameData, getWeekData } from '../../src/api/index.js';

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
    'HS256',
  );
}

describe('GET /api/admin/games', () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no games in DB without calling external API', async () => {
    const token = await makeAdminToken();
    const res = await app.request('/api/admin/games?year=2024&weekNumber=1', {
      headers: { Cookie: `auth_token=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weekGames).toEqual([]);
    expect(getGameData).not.toHaveBeenCalled();
  });

  it('returns stored games when they exist', async () => {
    await createTestGame(1, 2024, 'Alabama', 'Georgia');

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/games?year=2024&weekNumber=1', {
      headers: { Cookie: `auth_token=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.weekGames)).toBe(true);
    expect(body.weekGames.length).toBeGreaterThan(0);
    expect(getGameData).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/week', () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls external API and inserts returned games', async () => {
    vi.mocked(getGameData).mockResolvedValue([
      {
        gameId: 0,
        cfbdGameId: null,
        
        weekNumber: 2,
        year: 2024,
        seasonType: 'regular',
        completed: false,
        homeTeam: 'Michigan',
        awayTeam: 'Ohio State',
        homePoints: null,
        awayPoints: null,
        winningTeam: 'pending',
        spread: null,
        startTime: null,
      },
    ]);

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/week', {
      method: 'POST',
      headers: {
        Cookie: `auth_token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ year: 2024, week: 2 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('imported 1 games');
    expect(getGameData).toHaveBeenCalledOnce();
  });

  it('calling POST /admin/week twice does not duplicate rows', async () => {
    vi.mocked(getGameData).mockResolvedValue([
      {
        gameId: 0,
        cfbdGameId: null,
        
        weekNumber: 1,
        year: 2024,
        seasonType: 'regular',
        completed: false,
        homeTeam: 'Texas',
        awayTeam: 'Oklahoma',
        homePoints: null,
        awayPoints: null,
        winningTeam: 'pending',
        spread: null,
        startTime: null,
      },
    ]);

    const token = await makeAdminToken();
    const payload = JSON.stringify({ year: 2024, week: 1 });
    const headers = {
      Cookie: `auth_token=${token}`,
      'Content-Type': 'application/json',
    };

    await app.request('/api/admin/week', { method: 'POST', headers, body: payload });
    await app.request('/api/admin/week', { method: 'POST', headers, body: payload });

    const result = await testDb.execute(sql`
      SELECT COUNT(*) as count FROM "admin"."games"
      WHERE year = 2024 AND week_number = 1
      AND home_team = 'Texas' AND away_team = 'Oklahoma'
    `);
    expect(Number(result.rows[0].count)).toBe(1);
  });

  it('returns 422 when external API returns empty array', async () => {
    vi.mocked(getGameData).mockResolvedValue([]);

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/week', {
      method: 'POST',
      headers: {
        Cookie: `auth_token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ year: 2024, week: 1 }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns 502 with error detail when external API throws', async () => {
    vi.mocked(getGameData).mockRejectedValue(new Error('NCAA API unavailable'));

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/week', {
      method: 'POST',
      headers: {
        Cookie: `auth_token=${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ year: 2024, week: 1 }),
    });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('NCAA API unavailable');
  });
});

describe('POST /api/admin/year/:year', () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 502 with error detail when external API throws', async () => {
    vi.mocked(getWeekData).mockRejectedValue(new Error('NCAA API unavailable'));

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/year/2024', {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}` },
    });

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('NCAA API unavailable');
  });

  it('returns 200 with no DB writes when external API returns empty array', async () => {
    vi.mocked(getWeekData).mockResolvedValue([]);

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/year/2024', {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('added all weeks');
  });
});
