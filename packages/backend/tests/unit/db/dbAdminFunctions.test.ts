import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { seedTestData, createTestWeek, createTestGame, cleanDatabase } from '../../db-utils.js';
import {
	returnWeek,
  returnWeeksByYear,
	returnGamesForWeek,
	returnPickedGames,
	getSeasonTypeForWeek,
	enrichWeekIdentifier,
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
			await createTestGame( 1, 2024, 'Team A', 'Team B', true, false);

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

	describe('returnPickedGames', () => {
		it('should return only picked games', async () => {
			// Create picked and unpicked games
			await createTestGame( 1, 2024, 'Team A', 'Team B', true, false);
			await createTestGame( 1, 2024, 'Team C', 'Team D', false, false);

			const weekData: WeekIdentifier = {
				year: 2024,
				week: 1,
			};

			const pickedGames = await returnPickedGames(weekData);

			expect(Array.isArray(pickedGames)).toBe(true);
			expect(pickedGames.length).toBe(1);
			expect(pickedGames[0].picked).toBe(true);
		});

		it('should return empty array when no picked games exist', async () => {
			// Create only unpicked games
			await createTestGame( 1, 2024, 'Team A', 'Team B', false, false);

			const weekData: WeekIdentifier = {
				year: 2024,
				week: 1,
			};

			const pickedGames = await returnPickedGames(weekData);

			expect(Array.isArray(pickedGames)).toBe(true);
			expect(pickedGames.length).toBe(0);
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
});
