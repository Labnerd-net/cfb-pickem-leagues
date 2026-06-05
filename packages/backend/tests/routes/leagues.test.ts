import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { sql } from 'drizzle-orm';
import { seedTestData, testDb } from '../db-utils.js';
import leaguesRoute from '../../src/routes/leagues.js';

const TEST_JWT_SECRET = 'test-secret-key-do-not-use-in-production';

const app = new Hono();
app.route('/api/leagues', leaguesRoute);
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  return c.json({ error: 'An unexpected error occurred' }, 500);
});

async function makeToken(userId: number, roles: string[]) {
  return sign(
    { sub: userId, email: 'test@test.com', displayName: 'Test', roles, exp: Math.floor(Date.now() / 1000) + 3600 },
    TEST_JWT_SECRET,
    'HS256',
  );
}

async function cleanLeagues() {
  await testDb.execute(sql`TRUNCATE TABLE league_channels, league_games, league_members, leagues RESTART IDENTITY CASCADE`);
}

beforeEach(async () => {
  await seedTestData();
  await cleanLeagues();
});

// ---------------------------------------------------------------------------
// POST /api/leagues — create league
// ---------------------------------------------------------------------------
describe('POST /api/leagues', () => {
  it('creates a league and returns it with invite code (site admin)', async () => {
    const token = await makeToken(1, ['admin', 'user']);
    const res = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test League' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.league.name).toBe('Test League');
    expect(body.league.inviteCode).toBeTruthy();
    expect(body.league.role).toBe('admin');
    expect(body.league.memberCount).toBe(1);
  });

  it('returns 403 for non-admin users', async () => {
    const token = await makeToken(2, ['user']);
    const res = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test League' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 for empty name', async () => {
    const token = await makeToken(1, ['admin', 'user']);
    const res = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/leagues — list user's leagues
// ---------------------------------------------------------------------------
describe('GET /api/leagues', () => {
  it('returns empty list when user has no leagues', async () => {
    const token = await makeToken(2, ['user']);
    const res = await app.request('/api/leagues', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leagues).toEqual([]);
  });

  it('returns leagues the user belongs to', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'League One' }),
    });

    const res = await app.request('/api/leagues', {
      headers: { Cookie: `auth_token=${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.leagues).toHaveLength(1);
    expect(body.leagues[0].name).toBe('League One');
    expect(body.leagues[0].inviteCode).toBeTruthy(); // admin sees invite code
  });

  it('hides invite code from non-admin members', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'League One' }),
    });
    const { league } = await createRes.json();

    const userToken = await makeToken(2, ['user']);
    await app.request('/api/leagues/join', {
      method: 'POST',
      headers: { Cookie: `auth_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: league.inviteCode }),
    });

    const res = await app.request('/api/leagues', {
      headers: { Cookie: `auth_token=${userToken}` },
    });
    const body = await res.json();
    expect(body.leagues[0].inviteCode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/leagues/join
// ---------------------------------------------------------------------------
describe('POST /api/leagues/join', () => {
  it('joins a league with a valid invite code', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Join Test' }),
    });
    const { league } = await createRes.json();

    const userToken = await makeToken(2, ['user']);
    const res = await app.request('/api/leagues/join', {
      method: 'POST',
      headers: { Cookie: `auth_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: league.inviteCode }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.league.name).toBe('Join Test');
    expect(body.league.role).toBe('member');
  });

  it('returns 404 for an invalid invite code', async () => {
    const token = await makeToken(2, ['user']);
    const res = await app.request('/api/leagues/join', {
      method: 'POST',
      headers: { Cookie: `auth_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: 'badcode' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 409 if already a member', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dup Test' }),
    });
    const { league } = await createRes.json();

    // Try to join twice
    const res = await app.request('/api/leagues/join', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: league.inviteCode }),
    });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// GET /api/leagues/:leagueId
// ---------------------------------------------------------------------------
describe('GET /api/leagues/:leagueId', () => {
  it('returns 403 for non-members', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Private' }),
    });
    const { league } = await createRes.json();

    const userToken = await makeToken(2, ['user']);
    const res = await app.request(`/api/leagues/${league.leagueId}`, {
      headers: { Cookie: `auth_token=${userToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown leagueId', async () => {
    const token = await makeToken(1, ['admin', 'user']);
    const res = await app.request('/api/leagues/9999', {
      headers: { Cookie: `auth_token=${token}` },
    });
    expect(res.status).toBe(404);
  });

  it('admin sees invite code; member does not', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Visibility' }),
    });
    const { league } = await createRes.json();

    // Admin sees code
    const adminRes = await app.request(`/api/leagues/${league.leagueId}`, {
      headers: { Cookie: `auth_token=${adminToken}` },
    });
    const adminBody = await adminRes.json();
    expect(adminBody.league.inviteCode).toBeTruthy();

    // Member doesn't
    const userToken = await makeToken(2, ['user']);
    await app.request('/api/leagues/join', {
      method: 'POST',
      headers: { Cookie: `auth_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: league.inviteCode }),
    });
    const memberRes = await app.request(`/api/leagues/${league.leagueId}`, {
      headers: { Cookie: `auth_token=${userToken}` },
    });
    const memberBody = await memberRes.json();
    expect(memberBody.league.inviteCode).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GET /api/leagues/:leagueId/members
// ---------------------------------------------------------------------------
describe('GET /api/leagues/:leagueId/members', () => {
  it('returns members list for a league member', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Members Test' }),
    });
    const { league } = await createRes.json();

    const res = await app.request(`/api/leagues/${league.leagueId}/members`, {
      headers: { Cookie: `auth_token=${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(1);
    expect(body.members[0].role).toBe('admin');
  });

  it('returns 403 for non-members', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Private' }),
    });
    const { league } = await createRes.json();

    const userToken = await makeToken(2, ['user']);
    const res = await app.request(`/api/leagues/${league.leagueId}/members`, {
      headers: { Cookie: `auth_token=${userToken}` },
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/leagues/:leagueId/members/:userId — change role
// ---------------------------------------------------------------------------
describe('PATCH /api/leagues/:leagueId/members/:userId', () => {
  it('promotes a member to admin', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Role Test' }),
    });
    const { league } = await createRes.json();

    const userToken = await makeToken(2, ['user']);
    await app.request('/api/leagues/join', {
      method: 'POST',
      headers: { Cookie: `auth_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: league.inviteCode }),
    });

    const res = await app.request(`/api/leagues/${league.leagueId}/members/2`, {
      method: 'PATCH',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.member.role).toBe('admin');
  });

  it('returns 409 when the only admin tries to demote themselves', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Last Admin' }),
    });
    const { league } = await createRes.json();

    const res = await app.request(`/api/leagues/${league.leagueId}/members/1`, {
      method: 'PATCH',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 403 for non-admin members', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Guard Test' }),
    });
    const { league } = await createRes.json();

    const userToken = await makeToken(2, ['user']);
    await app.request('/api/leagues/join', {
      method: 'POST',
      headers: { Cookie: `auth_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: league.inviteCode }),
    });

    const res = await app.request(`/api/leagues/${league.leagueId}/members/1`, {
      method: 'PATCH',
      headers: { Cookie: `auth_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'member' }),
    });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/leagues/:leagueId/members/:userId — remove member
// ---------------------------------------------------------------------------
describe('DELETE /api/leagues/:leagueId/members/:userId', () => {
  it('removes a member', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Remove Test' }),
    });
    const { league } = await createRes.json();

    const userToken = await makeToken(2, ['user']);
    await app.request('/api/leagues/join', {
      method: 'POST',
      headers: { Cookie: `auth_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: league.inviteCode }),
    });

    const res = await app.request(`/api/leagues/${league.leagueId}/members/2`, {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 409 when only admin tries to remove themselves', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Solo Admin' }),
    });
    const { league } = await createRes.json();

    const res = await app.request(`/api/leagues/${league.leagueId}/members/1`, {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${adminToken}` },
    });
    expect(res.status).toBe(409);
  });

  it('returns 404 when target user is not a member of the league', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Non-member Test' }),
    });
    const { league } = await createRes.json();

    // User 999 is not a member of this league
    const res = await app.request(`/api/leagues/${league.leagueId}/members/999`, {
      method: 'DELETE',
      headers: { Cookie: `auth_token=${adminToken}` },
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/leagues/:leagueId/invite/regenerate
// ---------------------------------------------------------------------------
describe('POST /api/leagues/:leagueId/invite/regenerate', () => {
  it('regenerates the invite code', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Regen Test' }),
    });
    const { league } = await createRes.json();

    const res = await app.request(`/api/leagues/${league.leagueId}/invite/regenerate`, {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inviteCode).toBeTruthy();
    expect(body.inviteCode).not.toBe(league.inviteCode);
  });

  it('returns 403 for non-admin members', async () => {
    const adminToken = await makeToken(1, ['admin', 'user']);
    const createRes = await app.request('/api/leagues', {
      method: 'POST',
      headers: { Cookie: `auth_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Guard Regen' }),
    });
    const { league } = await createRes.json();

    const userToken = await makeToken(2, ['user']);
    await app.request('/api/leagues/join', {
      method: 'POST',
      headers: { Cookie: `auth_token=${userToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: league.inviteCode }),
    });

    const res = await app.request(`/api/leagues/${league.leagueId}/invite/regenerate`, {
      method: 'POST',
      headers: { Cookie: `auth_token=${userToken}` },
    });
    expect(res.status).toBe(403);
  });
});
