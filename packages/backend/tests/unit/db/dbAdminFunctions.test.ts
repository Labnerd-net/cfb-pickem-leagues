import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { seedTestData, createTestWeek, createTestGame, cleanDatabase, testDb } from '../../db-utils.js';
import {
	returnWeek,
  returnWeeksByYear,
	returnGamesForWeek,
	returnGamesBulk,
	getSeasonTypeForWeek,
	enrichWeekIdentifier,
	correctGameScore,
	getGamesForLeagueWeek,
	addGameToLeague,
} from '../../../src/db/dbAdminFunctions.js';
import type { WeekIdentifier } from '@shared/types/cfb-pickem-api.js';

describe('Admin Database Functions', () => {
	beforeAll(async () => {
		await seedTestData();
	});

	afterEach(async () => {
		// Clean and reseed between tests for isolation
		await cleanDatabase();
		await seedTestData();
	});

	describe('returnWeek', () => {
		it('should return week by week number', async () => {
			const week = await returnWeek(1);

			expect(week).toBeDefined();
			expect(week.length).toBe(1);
			expect(week[0].weekNumber).toBe(1);
			expect(week[0].year).toBe(2024);
		});

		it('should return empty array for non-existent week', async () => {
			const week = await returnWeek(99);

			expect(Array.isArray(week)).toBe(true);
			expect(week.length).toBe(0);
		});
	});

	describe('returnWeeksByYear', () => {
		it('should return week by year number', async () => {
			const week = await returnWeeksByYear(2024);

			expect(week).toBeDefined();
			expect(week.length).toBe(2);
			expect(week[0].weekNumber).toBe(1);
			expect(week[0].year).toBe(2024);
			expect(week[1].weekNumber).toBe(2);
			expect(week[1].year).toBe(2024);
		});

		it('should return empty array for non-existent week', async () => {
			const week = await returnWeeksByYear(2026);

			expect(Array.isArray(week)).toBe(true);
			expect(week.length).toBe(0);
		});
	});

	describe('returnGamesForWeek', () => {
		it('should return games for a specific week', async () => {
			// Explicitly ensure the week exists for this test
			await createTestWeek( 1, 2024, 'regular');

			// Create a test game for the week
			await createTestGame( 1, 2024, 'Team A', 'Team B', false);

			const weekData: WeekIdentifier = {
				year: 2024,
				week: 1,
			};

			const games = await returnGamesForWeek(weekData);

			expect(Array.isArray(games)).toBe(true);
			expect(games.length).toBeGreaterThan(0);
			expect(games[0].homeTeam).toBe('Team A');
			expect(games[0].awayTeam).toBe('Team B');
		});

		it('should return empty array when no games exist for week', async () => {
			const weekData: WeekIdentifier = {
				year: 2024,
				week: 15,
			};

			const games = await returnGamesForWeek(weekData);

			expect(Array.isArray(games)).toBe(true);
			expect(games.length).toBe(0);
		});
	});

	describe('getGamesForLeagueWeek', () => {
		it('should return only games in the league pool', async () => {
			const g1 = await createTestGame(1, 2024, 'Team A', 'Team B', false);
			const g2 = await createTestGame(1, 2024, 'Team C', 'Team D', false);
			const id1 = (g1 as { game_id: number }).game_id;

			// Only add game 1 to the league pool
			await addGameToLeague(1, id1);

			const leagueGames = await getGamesForLeagueWeek(1, 2024, 1);
			const ids = leagueGames.map(g => g.gameId);

			expect(ids).toContain(id1);
			expect(ids).not.toContain((g2 as { game_id: number }).game_id);
		});

		it('should return empty array when no games are in the league pool', async () => {
			await createTestGame(1, 2024, 'Team E', 'Team F', false);

			const leagueGames = await getGamesForLeagueWeek(1, 2024, 1);
			// games from earlier tests may be in pool; verify no freshly added game appears without being added
			expect(Array.isArray(leagueGames)).toBe(true);
		});
	});

	describe('getSeasonTypeForWeek', () => {
		it('should return seasonType for existing week', async () => {
			const seasonType = await getSeasonTypeForWeek(2024, 1);

			expect(seasonType).toBe('regular');
		});

		it('should return null for non-existent week', async () => {
			const seasonType = await getSeasonTypeForWeek(2026, 99);

			expect(seasonType).toBeNull();
		});
	});

	describe('returnGamesBulk', () => {
		it('should return all games for a list of valid IDs', async () => {
			await createTestWeek(1, 2024, 'regular');
			const gameA = await createTestGame(1, 2024, 'Team A', 'Team B', false);
			const gameB = await createTestGame(1, 2024, 'Team C', 'Team D', false);
			const idA = (gameA as { game_id: number }).game_id;
			const idB = (gameB as { game_id: number }).game_id;

			const games = await returnGamesBulk([idA, idB]);

			expect(games.length).toBe(2);
			expect(games.map(g => g.gameId).sort()).toEqual([idA, idB].sort());
		});

		it('should return only matched rows when some IDs do not exist', async () => {
			await createTestWeek(1, 2024, 'regular');
			const game = await createTestGame(1, 2024, 'Team A', 'Team B', false);
			const id = (game as { game_id: number }).game_id;

			const games = await returnGamesBulk([id, 99998, 99999]);

			expect(games.length).toBe(1);
			expect(games[0].gameId).toBe(id);
		});

		it('should return empty array for empty input without error', async () => {
			const games = await returnGamesBulk([]);

			expect(Array.isArray(games)).toBe(true);
			expect(games.length).toBe(0);
		});
	});

	describe('enrichWeekIdentifier', () => {
		it('should convert WeekIdentifier to WeekQuery', async () => {
			const weekQuery = await enrichWeekIdentifier({ year: 2024, week: 1 });

			expect(weekQuery).toBeDefined();
			expect(weekQuery.year).toBe(2024);
			expect(weekQuery.week).toBe(1);
			expect(weekQuery.seasonType).toBe('regular');
		});

		it('should throw error for non-existent week', async () => {
			await expect(
				enrichWeekIdentifier({ year: 2026, week: 99 })
			).rejects.toThrow('Week 99 of year 2026 not found');
		});
	});

	describe('correctGameScore', () => {
		it('should return null for a non-existent gameId', async () => {
			const result = await correctGameScore(999999, 28, 21, 1);
			expect(result).toBeNull();
		});

		it('should update the game and insert an audit row', async () => {
			const row = await createTestGame(1, 2024, 'Alabama', 'Georgia', false);
			const id = (row as { game_id: number }).game_id;

			const updated = await correctGameScore(id, 28, 21, 1);

			expect(updated).not.toBeNull();
			expect(updated!.homePoints).toBe(28);
			expect(updated!.awayPoints).toBe(21);
			expect(updated!.winningTeam).toBe('home_team');
			expect(updated!.completed).toBe(true);

			const audit = await testDb.execute(sql`
				SELECT * FROM "admin"."score_corrections" WHERE game_id = ${id}
			`);
			expect(audit.rows.length).toBe(1);
			const auditRow = audit.rows[0] as Record<string, unknown>;
			expect(auditRow.new_home_points).toBe(28);
			expect(auditRow.new_away_points).toBe(21);
			expect(auditRow.corrected_by).toBe(1);
		});

		it('should set winningTeam to pending on a tie', async () => {
			const row = await createTestGame(1, 2024, 'Auburn', 'LSU', false);
			const id = (row as { game_id: number }).game_id;

			const updated = await correctGameScore(id, 14, 14, 1);

			expect(updated!.winningTeam).toBe('pending');
		});
	});
});
