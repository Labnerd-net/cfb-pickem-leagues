import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server.js';
import {
  getLeagues,
  joinLeague,
  getLeagueMembers,
  updateMemberRole,
  removeMember,
  regenerateInviteCode,
  createLeague,
} from '../../../src/apis/leagueRequests.js';

const mockLeague = {
	leagueId: 1,
	name: 'Default League',
	memberCount: 2,
	createdAt: '2024-01-01T00:00:00.000Z',
	role: 'admin' as const,
};

describe('getLeagues', () => {
	it('returns success with leagues on 200', async () => {
		const result = await getLeagues();

		expect(result.success).toBe(true);
		expect(result.data).toEqual([mockLeague]);
	});

	it('returns failure with error on 4xx', async () => {
		server.use(
			http.get('http://localhost:3000/api/leagues', () =>
				HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
			),
		);

		const result = await getLeagues();

		expect(result.success).toBe(false);
		expect(result.error).toBe('Unauthorized');
	});

	it('returns failure with "Request failed" on network error', async () => {
		server.use(
			http.get('http://localhost:3000/api/leagues', () => HttpResponse.error()),
		);

		const result = await getLeagues();

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});

describe('joinLeague', () => {
	it('returns success with league data on 200', async () => {
		const result = await joinLeague('INVITE123');

		expect(result.success).toBe(true);
		expect(result.data?.leagueId).toBe(2);
		expect(result.data?.name).toBe('New League');
	});

	it('returns failure with status 404 for invalid invite code', async () => {
		server.use(
			http.post('http://localhost:3000/api/leagues/join', () =>
				HttpResponse.json({ error: 'League not found' }, { status: 404 }),
			),
		);

		const result = await joinLeague('BADCODE');

		expect(result.success).toBe(false);
		expect(result.status).toBe(404);
		expect(result.error).toBe('League not found');
	});

	it('returns failure with status 409 when already a member', async () => {
		server.use(
			http.post('http://localhost:3000/api/leagues/join', () =>
				HttpResponse.json({ error: 'Already a member' }, { status: 409 }),
			),
		);

		const result = await joinLeague('MYCODE');

		expect(result.success).toBe(false);
		expect(result.status).toBe(409);
		expect(result.error).toBe('Already a member');
	});

	it('returns failure with "Request failed" on network error', async () => {
		server.use(
			http.post('http://localhost:3000/api/leagues/join', () => HttpResponse.error()),
		);

		const result = await joinLeague('CODE');

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});

describe('getLeagueMembers', () => {
	it('returns success with member list on 200', async () => {
		const result = await getLeagueMembers(1);

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(2);
		expect(result.data?.[0].displayName).toBe('Test User');
		expect(result.data?.[0].role).toBe('admin');
		expect(result.data?.[1].role).toBe('member');
	});

	it('returns failure with error on 403', async () => {
		server.use(
			http.get('http://localhost:3000/api/leagues/:leagueId/members', () =>
				HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
			),
		);

		const result = await getLeagueMembers(1);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Forbidden');
	});

	it('returns failure on network error', async () => {
		server.use(
			http.get('http://localhost:3000/api/leagues/:leagueId/members', () => HttpResponse.error()),
		);

		const result = await getLeagueMembers(1);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});

describe('updateMemberRole', () => {
	it('returns success on 200', async () => {
		const result = await updateMemberRole(1, 2, 'admin');

		expect(result.success).toBe(true);
	});

	it('returns failure with status 409 when demoting last admin', async () => {
		server.use(
			http.patch('http://localhost:3000/api/leagues/:leagueId/members/:userId', () =>
				HttpResponse.json({ error: 'Cannot demote the only admin' }, { status: 409 }),
			),
		);

		const result = await updateMemberRole(1, 1, 'member');

		expect(result.success).toBe(false);
		expect(result.status).toBe(409);
		expect(result.error).toBe('Cannot demote the only admin');
	});

	it('returns failure on network error', async () => {
		server.use(
			http.patch('http://localhost:3000/api/leagues/:leagueId/members/:userId', () =>
				HttpResponse.error(),
			),
		);

		const result = await updateMemberRole(1, 2, 'admin');

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});

describe('removeMember', () => {
	it('returns success on 200', async () => {
		const result = await removeMember(1, 2);

		expect(result.success).toBe(true);
	});

	it('returns failure with status 409 when removing last admin', async () => {
		server.use(
			http.delete('http://localhost:3000/api/leagues/:leagueId/members/:userId', () =>
				HttpResponse.json({ error: 'Cannot remove the only admin' }, { status: 409 }),
			),
		);

		const result = await removeMember(1, 1);

		expect(result.success).toBe(false);
		expect(result.status).toBe(409);
	});

	it('returns failure on network error', async () => {
		server.use(
			http.delete('http://localhost:3000/api/leagues/:leagueId/members/:userId', () =>
				HttpResponse.error(),
			),
		);

		const result = await removeMember(1, 2);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});

describe('regenerateInviteCode', () => {
	it('returns success with new code on 200', async () => {
		const result = await regenerateInviteCode(1);

		expect(result.success).toBe(true);
		expect(result.data).toBe('NEWCODE9');
	});

	it('returns failure on error', async () => {
		server.use(
			http.post('http://localhost:3000/api/leagues/:leagueId/invite/regenerate', () =>
				HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
			),
		);

		const result = await regenerateInviteCode(1);

		expect(result.success).toBe(false);
		expect(result.error).toBe('Forbidden');
	});
});

describe('createLeague', () => {
	it('returns success with league data including invite code on 201', async () => {
		const result = await createLeague('Created League');

		expect(result.success).toBe(true);
		expect(result.data?.leagueId).toBe(3);
		expect(result.data?.name).toBe('Created League');
		expect(result.data?.inviteCode).toBe('NEWCODE1');
		expect(result.data?.role).toBe('admin');
	});

	it('returns failure on error', async () => {
		server.use(
			http.post('http://localhost:3000/api/leagues', () =>
				HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
			),
		);

		const result = await createLeague('My League');

		expect(result.success).toBe(false);
		expect(result.error).toBe('Forbidden');
	});

	it('returns failure on network error', async () => {
		server.use(
			http.post('http://localhost:3000/api/leagues', () => HttpResponse.error()),
		);

		const result = await createLeague('My League');

		expect(result.success).toBe(false);
		expect(result.error).toBe('Request failed');
	});
});
