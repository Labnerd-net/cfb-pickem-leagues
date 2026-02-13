import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3000';

export const handlers = [
	// Auth endpoints
	http.post(`${API_URL}/api/auth/login`, () => {
		return HttpResponse.json({
			ok: true,
			data: {
				token: 'mock-jwt-token',
				user: {
					userId: 1,
					email: 'test@example.com',
					displayName: 'Test User',
					roles: ['user'],
				},
			},
		});
	}),

	http.post(`${API_URL}/api/auth/register`, () => {
		return HttpResponse.json({
			ok: true,
			data: {
				token: 'mock-jwt-token',
				user: {
					userId: 1,
					email: 'newuser@example.com',
					displayName: 'New User',
					roles: ['user'],
				},
			},
		});
	}),

	http.delete(`${API_URL}/api/auth/deleteUser`, () => {
		return HttpResponse.json({
			ok: true,
			data: { message: 'User deleted successfully' },
		});
	}),

	// User endpoints
	http.get(`${API_URL}/api/user/profile`, () => {
		return HttpResponse.json({
			ok: true,
			data: {
				userId: 1,
				email: 'test@example.com',
				displayName: 'Test User',
				roles: ['user'],
			},
		});
	}),

	http.get(`${API_URL}/api/user/games`, () => {
		return HttpResponse.json({
			ok: true,
			data: [
				{
					gameId: 1,
					homeTeam: 'Team A',
					awayTeam: 'Team B',
					completed: false,
					picked: true,
				},
			],
		});
	}),

	http.get(`${API_URL}/api/user/picks`, () => {
		return HttpResponse.json({
			ok: true,
			data: [
				{
					gameId: 1,
					teamChosen: 'home_team',
				},
			],
		});
	}),

	http.post(`${API_URL}/api/user/picks`, () => {
		return HttpResponse.json({
			ok: true,
			data: { message: 'Picks saved successfully' },
		});
	}),

	// Admin endpoints
	http.post(`${API_URL}/api/admin/year/:year`, () => {
		return HttpResponse.json({
			ok: true,
			data: { message: 'Year populated successfully' },
		});
	}),

	http.post(`${API_URL}/api/admin/week`, () => {
		return HttpResponse.json({
			ok: true,
			data: { message: 'Week populated successfully' },
		});
	}),

	http.get(`${API_URL}/api/admin/getgames`, () => {
		return HttpResponse.json({
			ok: true,
			data: {
				weekGames: [
					{
						gameId: 1,
						homeTeam: 'Team A',
						awayTeam: 'Team B',
						completed: false,
						picked: true,
					},
				],
			},
		});
	}),

	http.post(`${API_URL}/api/admin/setpicks`, () => {
		return HttpResponse.json({
			ok: true,
			data: { message: 'Picks set successfully' },
		});
	}),

	http.post(`${API_URL}/api/admin/users`, () => {
		return HttpResponse.json({
			ok: true,
			data: [
				{
					userId: 1,
					email: 'test@example.com',
					displayName: 'Test User',
					roles: ['user'],
				},
			],
		});
	}),
];
