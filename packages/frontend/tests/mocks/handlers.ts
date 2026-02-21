import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3000';

export const handlers = [
	// Auth endpoints
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
					picked: true,
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
					picked: true,
				},
			],
		});
	}),

	http.post(`${API_URL}/api/admin/picks`, () => {
		return HttpResponse.json({ status: 'updated picked games' });
	}),

	http.get(`${API_URL}/api/admin/users`, () => {
		return HttpResponse.json({
			allUserProfiles: [
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
