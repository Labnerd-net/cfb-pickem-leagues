import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3000';

export const handlers = [
	// Auth endpoints
	http.get(`${API_URL}/api/auth/me`, () => {
		return HttpResponse.json(
			{ error: 'Unauthorized' },
			{ status: 401 },
		);
	}),

	http.post(`${API_URL}/api/auth/login`, () => {
		return HttpResponse.json({});
	}),

	http.post(`${API_URL}/api/auth/register`, () => {
		return HttpResponse.json({});
	}),

	http.delete(`${API_URL}/api/auth/deleteUser`, () => {
		return HttpResponse.json({ status: 'deleted' });
	}),

	// User endpoints
	http.get(`${API_URL}/api/user/profile`, () => {
		return HttpResponse.json({
			userId: 1,
			email: 'test@example.com',
			displayName: 'Test User',
			roles: ['user'],
		});
	}),

	http.get(`${API_URL}/api/user/games`, () => {
		return HttpResponse.json({
			pickedGames: [
				{
					gameId: 1,
					homeTeam: 'Team A',
					awayTeam: 'Team B',
					completed: false,
				},
			],
		});
	}),

	http.get(`${API_URL}/api/user/picks`, () => {
		return HttpResponse.json({
			picks: [
				{
					gameId: 1,
					teamChosen: 'home_team',
				},
			],
		});
	}),

	http.post(`${API_URL}/api/user/picks`, () => {
		return HttpResponse.json({ status: 'updated picked games' });
	}),

	// Admin endpoints
	http.post(`${API_URL}/api/admin/year/:year`, () => {
		return HttpResponse.json({ status: 'added all weeks' });
	}),

	http.post(`${API_URL}/api/admin/week`, () => {
		return HttpResponse.json({ status: 'added all games' });
	}),

	http.get(`${API_URL}/api/admin/games`, () => {
		return HttpResponse.json({
			weekGames: [
				{
					gameId: 1,
					homeTeam: 'Team A',
					awayTeam: 'Team B',
					completed: false,
				},
			],
		});
	}),

	http.post(`${API_URL}/api/admin/picks`, () => {
		return HttpResponse.json({ status: 'updated picked games' });
	}),

	// League endpoints
	http.get(`${API_URL}/api/leagues`, () => {
		return HttpResponse.json({
			leagues: [
				{
					leagueId: 1,
					name: 'Default League',
					memberCount: 2,
					createdAt: '2024-01-01T00:00:00.000Z',
					role: 'admin',
				},
			],
		});
	}),

	http.post(`${API_URL}/api/leagues/join`, () => {
		return HttpResponse.json({
			league: {
				leagueId: 2,
				name: 'New League',
				memberCount: 1,
				createdAt: '2024-01-01T00:00:00.000Z',
				role: 'member',
			},
		});
	}),

	http.post(`${API_URL}/api/leagues`, () => {
		return HttpResponse.json(
			{
				league: {
					leagueId: 3,
					name: 'Created League',
					inviteCode: 'NEWCODE1',
					memberCount: 1,
					createdAt: '2024-01-01T00:00:00.000Z',
					role: 'admin',
				},
			},
			{ status: 201 },
		);
	}),

	http.get(`${API_URL}/api/leagues/:leagueId/members`, () => {
		return HttpResponse.json({
			members: [
				{
					userId: 1,
					displayName: 'Test User',
					role: 'admin',
					joinedAt: '2024-01-01T00:00:00.000Z',
				},
				{
					userId: 2,
					displayName: 'Other User',
					role: 'member',
					joinedAt: '2024-01-02T00:00:00.000Z',
				},
			],
		});
	}),

	http.patch(`${API_URL}/api/leagues/:leagueId/members/:userId`, () => {
		return HttpResponse.json({
			member: { userId: 2, role: 'admin', joinedAt: '2024-01-02T00:00:00.000Z' },
		});
	}),

	http.delete(`${API_URL}/api/leagues/:leagueId/members/:userId`, () => {
		return HttpResponse.json({ success: true });
	}),

	http.post(`${API_URL}/api/leagues/:leagueId/invite/regenerate`, () => {
		return HttpResponse.json({ inviteCode: 'NEWCODE9' });
	}),

	// Admin league endpoints
	http.get(`${API_URL}/api/admin/leagues/:leagueId/games`, () => {
		return HttpResponse.json({
			games: [
				{
					gameId: 1,
					homeTeam: 'Team A',
					awayTeam: 'Team B',
					weekNumber: 1,
					seasonType: 'regular',
					completed: false,
					homePoints: null,
					awayPoints: null,
					winningTeam: null,
					inLeague: true,
				},
				{
					gameId: 2,
					homeTeam: 'Team C',
					awayTeam: 'Team D',
					weekNumber: 1,
					seasonType: 'regular',
					completed: false,
					homePoints: null,
					awayPoints: null,
					winningTeam: null,
					inLeague: false,
				},
			],
		});
	}),

	http.post(`${API_URL}/api/admin/weeks/sync-results`, () => {
		return HttpResponse.json({ gamesChecked: 3, gamesCompleted: 2, gamesSkipped: 0, leaguesNotified: 1 });
	}),

	http.post(`${API_URL}/api/admin/leagues/:leagueId/games/:gameId`, () => {
		return HttpResponse.json({ success: true }, { status: 201 });
	}),

	http.delete(`${API_URL}/api/admin/leagues/:leagueId/games/:gameId`, () => {
		return HttpResponse.json({ success: true });
	}),

	// Leaderboard endpoints
	http.get(`${API_URL}/api/leaderboard`, () => {
		return HttpResponse.json({
			leaderboard: [
				{
					userId: 1,
					displayName: 'Test User',
					total: 10,
					correct: 7,
					incorrect: 3,
					pending: 0,
					percentage: 0.7,
				},
			],
		});
	}),

	http.get(`${API_URL}/api/leaderboard/scores`, () => {
		return HttpResponse.json({
			scores: [
				{
					userId: 1,
					displayName: 'Test User',
					total: 5,
					correct: 3,
					incorrect: 1,
					pending: 1,
				},
			],
		});
	}),

	http.get(`${API_URL}/api/admin/users`, () => {
		return HttpResponse.json({
			allUserProfiles: [
				{
					userId: 1,
					email: 'test@example.com',
					displayName: 'Test User',
					roles: ['user'],
					emailVerified: false,
				},
			],
		});
	}),

	http.get(`${API_URL}/api/admin/notification-logs`, () => {
		return HttpResponse.json({
			entries: [
				{
					id: 1,
					userId: 0,
					year: 2024,
					weekNumber: 1,
					notificationType: 'games_ready',
					channel: 'ntfy',
					sentAt: '2024-09-01T12:00:00.000Z',
					recipient: 'Broadcast',
				},
			],
			total: 1,
		});
	}),

	// Notification endpoints
	http.get(`${API_URL}/api/user/notifications/preferences`, () => {
		return HttpResponse.json({
			preferences: [],
			emailVerified: false,
		});
	}),

	http.get(`${API_URL}/api/user/notifications/channels`, () => {
		return HttpResponse.json({ ntfy: null, telegram: null, discord: null });
	}),

	http.patch(`${API_URL}/api/user/notifications/preferences`, () => {
		return HttpResponse.json({ status: 'updated' });
	}),

	// Auth verification endpoints
	http.get(`${API_URL}/api/auth/verify-email`, () => {
		return HttpResponse.json({ status: 'verified' });
	}),

	http.post(`${API_URL}/api/auth/resend-verification`, () => {
		return HttpResponse.json({ status: 'sent' });
	}),
];
