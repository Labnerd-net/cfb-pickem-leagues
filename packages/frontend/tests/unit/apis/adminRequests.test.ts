import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server.js';
import {
  getUsers,
  getNotificationLogs,
  getLeagueGamesForWeek,
  addGameToLeague,
  removeGameFromLeague,
  markLeagueWeekComplete,
  correctLeagueGameScore,
} from '../../../src/apis/adminRequests.js';

describe('Admin API Requests', () => {
	beforeEach(() => {
		vi.mocked(localStorage.getItem).mockReturnValue('mock-jwt-token');
	});

	describe('getUsers', () => {
		it('should return success response with user list', async () => {
			const result = await getUsers();

			expect(result.success).toBe(true);
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data?.length).toBeGreaterThan(0);
			expect(result.data?.[0].email).toBe('test@example.com');
			expect(result.data?.[0].displayName).toBe('Test User');
		});

		it('should return failure when backend returns an error status', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/users', () => {
					return HttpResponse.json(
						{ error: 'Forbidden' },
						{ status: 403 },
					);
				}),
			);

			const result = await getUsers();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Forbidden');
		});

		it('should handle network errors', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/users', () => {
					return HttpResponse.error();
				}),
			);

			const result = await getUsers();

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe('getNotificationLogs', () => {
		it('should return success response with entries and total', async () => {
			const result = await getNotificationLogs();

			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data?.entries)).toBe(true);
			expect(typeof result.data?.total).toBe('number');
			expect(result.data?.entries[0].recipient).toBe('Broadcast');
		});

		it('should return failure when backend returns 403', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/notification-logs', () => {
					return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
				}),
			);

			const result = await getNotificationLogs();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Forbidden');
		});

		it('should handle network errors', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/notification-logs', () => {
					return HttpResponse.error();
				}),
			);

			const result = await getNotificationLogs();

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe('getLeagueGamesForWeek', () => {
		it('returns success with games including inLeague flag', async () => {
			const result = await getLeagueGamesForWeek(1, 2024, 1);

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
			expect(result.data?.[0].inLeague).toBe(true);
			expect(result.data?.[1].inLeague).toBe(false);
		});

		it('returns failure on 403', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/leagues/:leagueId/games', () =>
					HttpResponse.json({ error: 'Forbidden' }, { status: 403 }),
				),
			);

			const result = await getLeagueGamesForWeek(1, 2024, 1);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Forbidden');
		});

		it('returns failure on network error', async () => {
			server.use(
				http.get('http://localhost:3000/api/admin/leagues/:leagueId/games', () =>
					HttpResponse.error(),
				),
			);

			const result = await getLeagueGamesForWeek(1, 2024, 1);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Request failed');
		});
	});

	describe('addGameToLeague', () => {
		it('returns success on 201', async () => {
			const result = await addGameToLeague(1, 2);

			expect(result.success).toBe(true);
		});

		it('returns failure with status on 409 (game already in league)', async () => {
			server.use(
				http.post('http://localhost:3000/api/admin/leagues/:leagueId/games/:gameId', () =>
					HttpResponse.json({ error: 'Already in league' }, { status: 409 }),
				),
			);

			const result = await addGameToLeague(1, 2);

			expect(result.success).toBe(false);
			expect(result.status).toBe(409);
		});

		it('returns failure on network error', async () => {
			server.use(
				http.post('http://localhost:3000/api/admin/leagues/:leagueId/games/:gameId', () =>
					HttpResponse.error(),
				),
			);

			const result = await addGameToLeague(1, 2);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Request failed');
		});
	});

	describe('removeGameFromLeague', () => {
		it('returns success on 200', async () => {
			const result = await removeGameFromLeague(1, 2);

			expect(result.success).toBe(true);
		});

		it('returns failure with status 409 when game has picks', async () => {
			server.use(
				http.delete('http://localhost:3000/api/admin/leagues/:leagueId/games/:gameId', () =>
					HttpResponse.json({ error: 'Game has picks' }, { status: 409 }),
				),
			);

			const result = await removeGameFromLeague(1, 2);

			expect(result.success).toBe(false);
			expect(result.status).toBe(409);
			expect(result.error).toBe('Game has picks');
		});

		it('returns failure on network error', async () => {
			server.use(
				http.delete('http://localhost:3000/api/admin/leagues/:leagueId/games/:gameId', () =>
					HttpResponse.error(),
				),
			);

			const result = await removeGameFromLeague(1, 2);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Request failed');
		});
	});

	describe('markLeagueWeekComplete', () => {
		it('returns success with completed count on 200', async () => {
			const result = await markLeagueWeekComplete(1, 2024, 1);

			expect(result.success).toBe(true);
			expect(result.data?.completed).toBe(2);
		});

		it('returns failure on 422 (no games in pool)', async () => {
			server.use(
				http.post('http://localhost:3000/api/admin/leagues/:leagueId/games/complete', () =>
					HttpResponse.json({ error: 'No games in league pool for this week' }, { status: 422 }),
				),
			);

			const result = await markLeagueWeekComplete(1, 2024, 1);

			expect(result.success).toBe(false);
			expect(result.error).toBe('No games in league pool for this week');
		});

		it('returns failure on network error', async () => {
			server.use(
				http.post('http://localhost:3000/api/admin/leagues/:leagueId/games/complete', () =>
					HttpResponse.error(),
				),
			);

			const result = await markLeagueWeekComplete(1, 2024, 1);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Request failed');
		});
	});

	describe('correctLeagueGameScore', () => {
		it('returns success with updated game on 200', async () => {
			const result = await correctLeagueGameScore(1, 1, { homePoints: 24, awayPoints: 17 });

			expect(result.success).toBe(true);
			expect(result.data?.homePoints).toBe(24);
			expect(result.data?.awayPoints).toBe(17);
			expect(result.data?.winningTeam).toBe('home_team');
		});

		it('returns failure on 404 (game not found)', async () => {
			server.use(
				http.patch('http://localhost:3000/api/admin/leagues/:leagueId/games/:gameId/score', () =>
					HttpResponse.json({ error: 'Game not found' }, { status: 404 }),
				),
			);

			const result = await correctLeagueGameScore(1, 99, { homePoints: 24, awayPoints: 17 });

			expect(result.success).toBe(false);
			expect(result.error).toBe('Game not found');
		});

		it('returns failure on network error', async () => {
			server.use(
				http.patch('http://localhost:3000/api/admin/leagues/:leagueId/games/:gameId/score', () =>
					HttpResponse.error(),
				),
			);

			const result = await correctLeagueGameScore(1, 1, { homePoints: 24, awayPoints: 17 });

			expect(result.success).toBe(false);
			expect(result.error).toBe('Request failed');
		});
	});
});
