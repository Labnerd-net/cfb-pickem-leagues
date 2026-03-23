import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { sql } from 'drizzle-orm';
import { seedTestData, createTestGame, createTestWeek, createTestPick, testDb } from '../db-utils.js';
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
    'HS256',
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
    'HS256',
  );
}

describe('DELETE /api/admin/year/:year', () => {
  beforeAll(async () => {
    await seedTestData();
  });

  it('returns 401 with no auth cookie', async () => {
    const res = await app.request('/api/admin/year/2024', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin user', async () => {
    const token = await makeUserToken();
    const res = await app.request('/api/admin/year/2024', {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 for non-numeric year param', async () => {
    const token = await makeAdminToken();
    const res = await app.request('/api/admin/year/abc', {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for year out of range', async () => {
    const token = await makeAdminToken();
    const res = await app.request('/api/admin/year/1800', {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 when year does not exist in DB', async () => {
    const token = await makeAdminToken();
    const res = await app.request('/api/admin/year/2099', {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('deleted');
  });

  it('returns 200 and removes weeks and games when no picks exist', async () => {
    await createTestWeek(1, 2030);
    await createTestGame(1, 2030, 'Ohio State', 'Michigan');

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/year/2030', {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('deleted');

    const weeks = await testDb.execute(
      sql`SELECT * FROM "admin"."weeks" WHERE year = 2030`
    );
    expect(weeks.rows.length).toBe(0);

    const games = await testDb.execute(
      sql`SELECT * FROM "admin"."games" WHERE year = 2030`
    );
    expect(games.rows.length).toBe(0);
  });

  it('returns 409 when picks exist for a game in the year', async () => {
    await createTestWeek(1, 2031);
    const gameRow = await createTestGame(1, 2031, 'Alabama', 'Georgia');
    const gameId = (gameRow as { game_id: number }).game_id;
    await createTestPick(1, gameId);

    const token = await makeAdminToken();
    const res = await app.request('/api/admin/year/2031', {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/picks exist/i);

    // rows should still be present
    const weeks = await testDb.execute(
      sql`SELECT * FROM "admin"."weeks" WHERE year = 2031`
    );
    expect(weeks.rows.length).toBeGreaterThan(0);
  });
});
