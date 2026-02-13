import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { getTestDb, cleanDatabase, seedTestData, createTestWeek, createTestGame } from '../../db-utils.js';
import {
	returnWeek,
	returnGamesForWeek,
	returnPickedGames,
} from '../../../src/db/dbAdminFunctions.js';
import type { WeekIdData } from '@shared/types/cfb-pickem-api.js';

describe('Admin Database Functions', () => {
	const testDb = getTestDb();

	beforeAll(async () => {
		await seedTestData(testDb);
	});

	afterEach(async () => {
		await cleanDatabase(testDb);
		await seedTestData(testDb);
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

	describe('returnGamesForWeek', () => {
		it('should return games for a specific week', async () => {
			// Explicitly ensure the week exists for this test
			await createTestWeek(testDb, 2024001, 1, 2024, 'regular');

			// Create a test game for the week
			await createTestGame(testDb, 2024001, 1, 2024, 'Team A', 'Team B', true, false);

			const weekData: WeekIdData = {
				year: 2024,
				week: 1,
				seasonType: 'regular',
			};

			const games = await returnGamesForWeek(weekData);

			expect(Array.isArray(games)).toBe(true);
			expect(games.length).toBeGreaterThan(0);
			expect(games[0].homeTeam).toBe('Team A');
			expect(games[0].awayTeam).toBe('Team B');
		});

		it('should return empty array when no games exist for week', async () => {
			const weekData: WeekIdData = {
				year: 2024,
				week: 15,
				seasonType: 'regular',
			};

			const games = await returnGamesForWeek(weekData);

			expect(Array.isArray(games)).toBe(true);
			expect(games.length).toBe(0);
		});
	});

	describe('returnPickedGames', () => {
		it('should return only picked games', async () => {
			// Create picked and unpicked games
			await createTestGame(testDb, 2024001, 1, 2024, 'Team A', 'Team B', true, false);
			await createTestGame(testDb, 2024001, 1, 2024, 'Team C', 'Team D', false, false);

			const weekData: WeekIdData = {
				year: 2024,
				week: 1,
				seasonType: 'regular',
			};

			const pickedGames = await returnPickedGames(weekData);

			expect(Array.isArray(pickedGames)).toBe(true);
			expect(pickedGames.length).toBe(1);
			expect(pickedGames[0].picked).toBe(true);
		});

		it('should return empty array when no picked games exist', async () => {
			// Create only unpicked games
			await createTestGame(testDb, 2024001, 1, 2024, 'Team A', 'Team B', false, false);

			const weekData: WeekIdData = {
				year: 2024,
				week: 1,
				seasonType: 'regular',
			};

			const pickedGames = await returnPickedGames(weekData);

			expect(Array.isArray(pickedGames)).toBe(true);
			expect(pickedGames.length).toBe(0);
		});
	});
});
