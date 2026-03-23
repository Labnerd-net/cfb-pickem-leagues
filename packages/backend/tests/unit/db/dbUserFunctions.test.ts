import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { seedTestData, createTestWeek, createTestGame, cleanDatabase } from '../../db-utils.js';
import {
	returnUsers,
	returnUserByEmail,
	returnUserById,
	returnTotalUserCount,
	addPickedGame,
	addPickedGamesBatch,
	returnUserGames,
	returnLeaderboard,
	returnWeekScores,
	returnUserPickCount,
	returnUserPickHistory,
	returnUserPickTotals,
} from '../../../src/db/dbUserFunctions.js';
import { db } from '../../../src/db/index.js';

describe('User Database Functions', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	describe('returnTotalUserCount', () => {
		afterEach(async () => {
			await cleanDatabase();
			await seedTestData();
		});

		it('counts only active users when no deleted users exist', async () => {
			const count = await returnTotalUserCount();
			expect(count).toBe(2); // seedTestData inserts 2 users
		});

		it('includes deleted users in the total', async () => {
			await db.execute(
				sql`INSERT INTO "user"."deleted_users" (user_id, email, display_name, roles, created_at) VALUES (999, 'deleted@test.com', 'Deleted User', ARRAY['user']::text[], NOW())`
			);
			const count = await returnTotalUserCount();
			expect(count).toBe(3); // 2 active + 1 deleted
		});

		it('returns 0 when both tables are empty', async () => {
			await cleanDatabase();
			const count = await returnTotalUserCount();
			expect(count).toBe(0);
		});

		it('returns deleted count when active table is empty', async () => {
			await cleanDatabase();
			await db.execute(
				sql`INSERT INTO "user"."deleted_users" (user_id, email, display_name, roles, created_at) VALUES (1, 'gone@test.com', 'Gone User', ARRAY['admin', 'user']::text[], NOW())`
			);
			const count = await returnTotalUserCount();
			expect(count).toBe(1);
		});
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
			// FK constraint violation from DB — caller is responsible for pre-validating game existence
			await expect(addPickedGame({ game: 99999, pick: 'home_team' }, '1')).rejects.toThrow();
		});
	});

	describe('addPickedGamesBatch', () => {
		afterEach(async () => {
			await cleanDatabase();
			await seedTestData();
		});

		it('should insert all picks when all games are valid', async () => {
			await createTestWeek(1, 2024, 'regular');
			const game1 = await createTestGame(1, 2024, 'Team A', 'Team B', true, false);
			const game2 = await createTestGame(1, 2024, 'Team C', 'Team D', true, false);
			const gameId1 = (game1 as { game_id: number }).game_id;
			const gameId2 = (game2 as { game_id: number }).game_id;

			await addPickedGamesBatch(
				[
					{ game: gameId1, pick: 'home_team' },
					{ game: gameId2, pick: 'away_team' },
				],
				'1'
			);

			const rows = await db.execute(
				sql`SELECT game_id, team_chosen FROM "user"."games" WHERE user_id = 1 ORDER BY game_id`
			);
			expect(rows.rows.length).toBe(2);
			expect(rows.rows[0]).toMatchObject({ game_id: gameId1, team_chosen: 'home_team' });
			expect(rows.rows[1]).toMatchObject({ game_id: gameId2, team_chosen: 'away_team' });
		});

		it('should roll back all picks when one insert fails mid-batch', async () => {
			await createTestWeek(1, 2024, 'regular');
			const game1 = await createTestGame(1, 2024, 'Team A', 'Team B', true, false);
			const gameId1 = (game1 as { game_id: number }).game_id;
			const nonExistentGameId = 999999;

			await expect(
				addPickedGamesBatch(
					[
						{ game: gameId1, pick: 'home_team' },
						{ game: nonExistentGameId, pick: 'away_team' },
					],
					'1'
				)
			).rejects.toThrow();

			const rows = await db.execute(
				sql`SELECT game_id FROM "user"."games" WHERE user_id = 1`
			);
			expect(rows.rows.length).toBe(0);
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

	describe('returnLeaderboard', () => {
		afterEach(async () => {
			await cleanDatabase();
			await seedTestData();
		});

		it('returns correct/incorrect/pending counts for a user with picks', async () => {
			await createTestWeek(1, 2024, 'regular');
			const g1 = await createTestGame(1, 2024, 'Home A', 'Away A', true, true);
			const g2 = await createTestGame(1, 2024, 'Home B', 'Away B', true, true);
			const g3 = await createTestGame(1, 2024, 'Home C', 'Away C', true, false);
			const id1 = (g1 as { game_id: number }).game_id;
			const id2 = (g2 as { game_id: number }).game_id;
			const id3 = (g3 as { game_id: number }).game_id;

			// Mark g1 home wins, g2 away wins, g3 still pending
			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id1}`);
			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'away_team' WHERE game_id = ${id2}`);

			// User 1: correct on g1, incorrect on g2, pending on g3
			await addPickedGame({ game: id1, pick: 'home_team' }, '1');
			await addPickedGame({ game: id2, pick: 'home_team' }, '1');
			await addPickedGame({ game: id3, pick: 'home_team' }, '1');

			const entries = await returnLeaderboard(2024);
			const user1 = entries.find(e => e.userId === 1)!;

			expect(user1.correct).toBe(1);
			expect(user1.incorrect).toBe(1);
			expect(user1.pending).toBe(1);
			expect(user1.total).toBe(2); // total = finished games (correct + incorrect), not all picked
		});

		it('calculates percentage correctly', async () => {
			await createTestWeek(1, 2024, 'regular');
			const g1 = await createTestGame(1, 2024, 'Home A', 'Away A', true, true);
			const g2 = await createTestGame(1, 2024, 'Home B', 'Away B', true, true);
			const id1 = (g1 as { game_id: number }).game_id;
			const id2 = (g2 as { game_id: number }).game_id;

			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id1}`);
			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id2}`);

			// User 1: 1 correct out of 2 total (50%)
			await addPickedGame({ game: id1, pick: 'home_team' }, '1');
			await addPickedGame({ game: id2, pick: 'away_team' }, '1');

			const entries = await returnLeaderboard(2024);
			const user1 = entries.find(e => e.userId === 1)!;

			expect(user1.percentage).toBeCloseTo(0.5);
		});

		it('returns null percentage for user with zero picks', async () => {
			// User 2 has no picks — still appears due to LEFT JOIN
			const entries = await returnLeaderboard(2024);
			const user2 = entries.find(e => e.userId === 2)!;

			expect(user2).toBeDefined();
			expect(user2.total).toBe(0);
			expect(user2.correct).toBe(0);
			expect(user2.percentage).toBeNull();
		});

		it('orders tied users by correct count descending', async () => {
			await createTestWeek(1, 2024, 'regular');
			const g1 = await createTestGame(1, 2024, 'Home A', 'Away A', true, true);
			const g2 = await createTestGame(1, 2024, 'Home B', 'Away B', true, true);
			const id1 = (g1 as { game_id: number }).game_id;
			const id2 = (g2 as { game_id: number }).game_id;

			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id1}`);
			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id2}`);

			// User 1: 2 correct; User 2: 1 correct — user 1 should rank first
			await addPickedGame({ game: id1, pick: 'home_team' }, '1');
			await addPickedGame({ game: id2, pick: 'home_team' }, '1');
			await addPickedGame({ game: id1, pick: 'home_team' }, '2');
			await addPickedGame({ game: id2, pick: 'away_team' }, '2');

			const entries = await returnLeaderboard(2024);

			expect(entries[0].userId).toBe(1);
			expect(entries[0].correct).toBe(2);
			expect(entries[1].userId).toBe(2);
			expect(entries[1].correct).toBe(1);
		});

		it('returns empty array for a year with no data', async () => {
			const entries = await returnLeaderboard(1999);

			// All users appear (LEFT JOIN) but with zero picks
			entries.forEach(e => {
				expect(e.total).toBe(0);
				expect(e.percentage).toBeNull();
			});
		});

		it('does not include picks from other years', async () => {
			await createTestWeek(1, 2024, 'regular');
			await createTestWeek(1, 2025, 'regular');
			const g2024 = await createTestGame(1, 2024, 'Home A', 'Away A', true, true);
			const g2025 = await createTestGame(1, 2025, 'Home B', 'Away B', true, true);
			const id2024 = (g2024 as { game_id: number }).game_id;
			const id2025 = (g2025 as { game_id: number }).game_id;

			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id2024}`);
			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id2025}`);

			// User 1 picks correctly in both years
			await addPickedGame({ game: id2024, pick: 'home_team' }, '1');
			await addPickedGame({ game: id2025, pick: 'home_team' }, '1');

			const entries2024 = await returnLeaderboard(2024);
			const user1in2024 = entries2024.find(e => e.userId === 1)!;

			// Only the 2024 pick should count
			expect(user1in2024.total).toBe(1);
			expect(user1in2024.correct).toBe(1);
		});

		it('does not count voided picks on pending games as pending', async () => {
			await createTestWeek(1, 2024, 'regular');
			const g1 = await createTestGame(1, 2024, 'Home A', 'Away A', true, false);
			const id1 = (g1 as { game_id: number }).game_id;

			// Game is still pending (winningTeam = 'pending' by default)
			await db.execute(sql`
				INSERT INTO "user"."games" (user_id, game_id, team_chosen)
				VALUES (1, ${id1}, 'voided')
			`);

			const entries = await returnLeaderboard(2024);
			const user1 = entries.find(e => e.userId === 1)!;

			expect(user1.pending).toBe(0);
			expect(user1.correct).toBe(0);
			expect(user1.incorrect).toBe(0);
		});

		it('does not count voided picks as incorrect', async () => {
			await createTestWeek(1, 2024, 'regular');
			const g1 = await createTestGame(1, 2024, 'Home A', 'Away A', true, true);
			const g2 = await createTestGame(1, 2024, 'Home B', 'Away B', true, false);
			const id1 = (g1 as { game_id: number }).game_id;
			const id2 = (g2 as { game_id: number }).game_id;

			// g1 completed with home_team winning; g2 pending
			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id1}`);

			// User 1 has one real correct pick and one voided pick on a completed game
			await addPickedGame({ game: id1, pick: 'home_team' }, '1');
			await db.execute(sql`
				INSERT INTO "user"."games" (user_id, game_id, team_chosen)
				VALUES (1, ${id2}, 'voided')
			`);

			const entries = await returnLeaderboard(2024);
			const user1 = entries.find(e => e.userId === 1)!;

			// Voided pick on g2 should not appear in incorrect count
			expect(user1.correct).toBe(1);
			expect(user1.incorrect).toBe(0);
		});
	});

	describe('voided pick exclusions', () => {
		afterEach(async () => {
			await cleanDatabase();
			await seedTestData();
		});

		it('returnUserGames excludes voided picks', async () => {
			await createTestWeek(1, 2024, 'regular');
			const g1 = await createTestGame(1, 2024, 'Team A', 'Team B', true, false);
			const g2 = await createTestGame(1, 2024, 'Team C', 'Team D', true, false);
			const id1 = (g1 as { game_id: number }).game_id;
			const id2 = (g2 as { game_id: number }).game_id;

			await addPickedGame({ game: id1, pick: 'home_team' }, '1');
			await db.execute(sql`
				INSERT INTO "user"."games" (user_id, game_id, team_chosen)
				VALUES (1, ${id2}, 'voided')
			`);

			const picks = await returnUserGames({ year: 2024, week: 1 }, '1');

			expect(picks.length).toBe(1);
			expect(picks[0].gameId).toBe(id1);
			expect(picks.every(p => p.teamChosen !== 'voided')).toBe(true);
		});

		it('returnUserPickCount excludes voided picks', async () => {
			await createTestWeek(1, 2024, 'regular');
			const g1 = await createTestGame(1, 2024, 'Team A', 'Team B', true, false);
			const g2 = await createTestGame(1, 2024, 'Team C', 'Team D', true, false);
			const id1 = (g1 as { game_id: number }).game_id;
			const id2 = (g2 as { game_id: number }).game_id;

			await addPickedGame({ game: id1, pick: 'home_team' }, '1');
			await db.execute(sql`
				INSERT INTO "user"."games" (user_id, game_id, team_chosen)
				VALUES (1, ${id2}, 'voided')
			`);

			const count = await returnUserPickCount(1, 2024, 1);

			// Only 1 non-voided pick should be counted
			expect(count).toBe(1);
		});

		it('returnWeekScores excludes voided picks from totals', async () => {
			await createTestWeek(1, 2024, 'regular');
			const g1 = await createTestGame(1, 2024, 'Home A', 'Away A', true, true);
			const g2 = await createTestGame(1, 2024, 'Home B', 'Away B', true, true);
			const id1 = (g1 as { game_id: number }).game_id;
			const id2 = (g2 as { game_id: number }).game_id;

			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id1}`);
			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id2}`);

			// User 1: one correct pick and one voided pick on a completed game
			await addPickedGame({ game: id1, pick: 'home_team' }, '1');
			await db.execute(sql`
				INSERT INTO "user"."games" (user_id, game_id, team_chosen)
				VALUES (1, ${id2}, 'voided')
			`);

			const scores = await returnWeekScores(2024, 1);
			const user1 = scores.find(s => s.userId === 1)!;

			expect(user1.correct).toBe(1);
			expect(user1.incorrect).toBe(0);
			// total = correct + incorrect only (no voided)
			expect(user1.total).toBe(1);
		});

		it('returnUserPickHistory excludes voided picks from total and incorrect counts', async () => {
			await createTestWeek(1, 2024, 'regular');
			const g1 = await createTestGame(1, 2024, 'Home A', 'Away A', true, true);
			const g2 = await createTestGame(1, 2024, 'Home B', 'Away B', true, true);
			const id1 = (g1 as { game_id: number }).game_id;
			const id2 = (g2 as { game_id: number }).game_id;

			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id1}`);
			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id2}`);

			// User 1: one correct pick and one voided pick on a completed game
			await addPickedGame({ game: id1, pick: 'home_team' }, '1');
			await db.execute(sql`
				INSERT INTO "user"."games" (user_id, game_id, team_chosen)
				VALUES (1, ${id2}, 'voided')
			`);

			const history = await returnUserPickHistory(2024, '1');
			expect(history.length).toBe(1);
			const week1 = history[0];

			expect(week1.total).toBe(1);
			expect(week1.correct).toBe(1);
			expect(week1.incorrect).toBe(0);
		});
	});

	describe('returnUserPickTotals', () => {
		afterEach(async () => {
			await cleanDatabase();
			await seedTestData();
		});

		it('returns zero totals for users with no picks', async () => {
			const totals = await returnUserPickTotals();
			expect(Array.isArray(totals)).toBe(true);
			expect(totals.length).toBe(2); // 2 seeded users
			totals.forEach(t => {
				expect(t.total).toBe(0);
				expect(t.correct).toBe(0);
			});
		});

		it('counts total and correct picks across all years', async () => {
			await createTestWeek(1, 2024, 'regular');
			await createTestWeek(1, 2025, 'regular');
			const g1 = await createTestGame(1, 2024, 'Home A', 'Away A', true, true);
			const g2 = await createTestGame(1, 2025, 'Home B', 'Away B', true, true);
			const id1 = (g1 as { game_id: number }).game_id;
			const id2 = (g2 as { game_id: number }).game_id;

			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'home_team' WHERE game_id = ${id1}`);
			await db.execute(sql`UPDATE "admin"."games" SET winning_team = 'away_team' WHERE game_id = ${id2}`);

			// User 1: correct on g1, incorrect on g2
			await addPickedGame({ game: id1, pick: 'home_team' }, '1');
			await addPickedGame({ game: id2, pick: 'home_team' }, '1');

			const totals = await returnUserPickTotals();
			const user1 = totals.find(t => t.userId === 1)!;
			expect(user1).toBeDefined();
			expect(user1.total).toBe(2);
			expect(user1.correct).toBe(1);

			// User 2 has no picks
			const user2 = totals.find(t => t.userId === 2)!;
			expect(user2.total).toBe(0);
			expect(user2.correct).toBe(0);
		});

		it('excludes voided picks from total', async () => {
			await createTestWeek(1, 2024, 'regular');
			const g1 = await createTestGame(1, 2024, 'Home A', 'Away A', true, false);
			const id1 = (g1 as { game_id: number }).game_id;

			await addPickedGame({ game: id1, pick: 'home_team' }, '1');
			// Mark the pick as voided
			await db.execute(sql`UPDATE "user"."games" SET team_chosen = 'voided' WHERE user_id = 1 AND game_id = ${id1}`);

			const totals = await returnUserPickTotals();
			const user1 = totals.find(t => t.userId === 1)!;
			expect(user1.total).toBe(0);
			expect(user1.correct).toBe(0);
		});
	});
});
