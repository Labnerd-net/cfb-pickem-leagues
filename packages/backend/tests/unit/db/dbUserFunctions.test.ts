import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { seedTestData, createTestWeek, createTestGame, cleanDatabase } from '../../db-utils.js';
import {
	returnUsers,
	returnUserByEmail,
	returnUserById,
	addPickedGame,
	returnUserGames,
} from '../../../src/db/dbUserFunctions.js';
import { db } from '../../../src/db/index.js';

describe('User Database Functions', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	describe('returnUsers', () => {
		it('should return all users', async () => {
			const users = await returnUsers();

			expect(users).toBeDefined();
			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBeGreaterThan(0);
		});
	});

	describe('returnUserByEmail', () => {
		it('should return user when email exists', async () => {
			const users = await returnUserByEmail('admin@test.com');

			expect(users).toBeDefined();
			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBe(1);
			expect(users[0].email).toBe('admin@test.com');
			expect(users[0].displayName).toBe('Test Admin');
			expect(users[0].roles).toContain('admin');
		});

		it('should return empty array when email does not exist', async () => {
			const users = await returnUserByEmail('nonexistent@test.com');

			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBe(0);
		});
	});

	describe('returnUserById', () => {
		it('should return user when ID exists', async () => {
			const users = await returnUserById(1);

			expect(users).toBeDefined();
			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBe(1);
			expect(users[0].userId).toBe(1);
			expect(users[0].email).toBe('admin@test.com');
		});

		it('should return empty array when ID does not exist', async () => {
			const users = await returnUserById(999);

			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBe(0);
		});
	});

	describe('addPickedGame', () => {
		afterEach(async () => {
			await cleanDatabase();
			await seedTestData();
		});

		it('should insert only userId, gameId, teamChosen into user.games', async () => {
			await createTestWeek(1, 2024, 'regular');
			const game = await createTestGame(1, 2024, 'Team A', 'Team B', true, false);
			const gameId = (game as { game_id: number }).game_id;

			await addPickedGame({ game: gameId, pick: 'home_team' }, '1');

			const rows = await db.execute(
				sql`SELECT user_id, game_id, team_chosen FROM "user"."games" WHERE user_id = 1 AND game_id = ${gameId}`
			);
			expect(rows.rows.length).toBe(1);
			expect(rows.rows[0]).toMatchObject({
				user_id: 1,
				game_id: gameId,
				team_chosen: 'home_team',
			});
		});

		it('should update teamChosen when pick is re-submitted for same game', async () => {
			await createTestWeek(1, 2024, 'regular');
			const game = await createTestGame(1, 2024, 'Team A', 'Team B', true, false);
			const gameId = (game as { game_id: number }).game_id;

			await addPickedGame({ game: gameId, pick: 'home_team' }, '1');
			await addPickedGame({ game: gameId, pick: 'away_team' }, '1');

			const rows = await db.execute(
				sql`SELECT team_chosen FROM "user"."games" WHERE user_id = 1 AND game_id = ${gameId}`
			);
			expect(rows.rows.length).toBe(1);
			expect(rows.rows[0]).toMatchObject({ team_chosen: 'away_team' });
		});

		it('should throw when game does not exist', async () => {
			await expect(addPickedGame({ game: 99999, pick: 'home_team' }, '1')).rejects.toThrow(
				"Game Doesn't Exist"
			);
		});
	});

	describe('returnUserGames', () => {
		afterEach(async () => {
			await cleanDatabase();
			await seedTestData();
		});

		it('should return full game metadata via join', async () => {
			await createTestWeek(1, 2024, 'regular');
			const game = await createTestGame(1, 2024, 'Team A', 'Team B', true, false);
			const gameId = (game as { game_id: number }).game_id;

			await addPickedGame({ game: gameId, pick: 'home_team' }, '1');

			const picks = await returnUserGames({ year: 2024, week: 1 }, '1');

			expect(picks.length).toBe(1);
			expect(picks[0]).toMatchObject({
				gameId,
				userId: 1,
				teamChosen: 'home_team',
				homeTeam: 'Team A',
				awayTeam: 'Team B',
				year: 2024,
				weekNumber: 1,
				seasonType: 'regular',
				completed: false,
			});
		});

		it('should reflect updated scores from admin.games without re-submitting pick', async () => {
			await createTestWeek(1, 2024, 'regular');
			const game = await createTestGame(1, 2024, 'Team A', 'Team B', true, false);
			const gameId = (game as { game_id: number }).game_id;

			await addPickedGame({ game: gameId, pick: 'home_team' }, '1');

			// Update scores in admin.games after pick was stored
			await db.execute(sql`
				UPDATE "admin"."games"
				SET completed = true, home_points = 28, away_points = 14, winning_team = 'home_team'
				WHERE game_id = ${gameId}
			`);

			const picks = await returnUserGames({ year: 2024, week: 1 }, '1');

			expect(picks.length).toBe(1);
			expect(picks[0]).toMatchObject({
				completed: true,
				homePoints: 28,
				awayPoints: 14,
				winningTeam: 'home_team',
			});
		});

		it('should return empty array when no picks exist for the week', async () => {
			const picks = await returnUserGames({ year: 2024, week: 1 }, '1');

			expect(Array.isArray(picks)).toBe(true);
			expect(picks.length).toBe(0);
		});
	});
});
