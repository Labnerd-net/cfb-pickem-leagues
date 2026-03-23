import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdminWeekData } from '@shared/types/cfb-pickem-api.js';

// Mock the external API modules before importing converters
vi.mock('../../../src/api/cfbd.js', () => ({
	getCfbdWeekData: vi.fn(),
	getCfbdGameData: vi.fn(),
	getCfbdLinesData: vi.fn(),
}));

describe('API Converters', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	describe('getWeekData - CFBD', () => {
		it('should renumber postseason weeks continuously after regular season', async () => {
			const { getCfbdWeekData } = await import('../../../src/api/cfbd.js');
			vi.mocked(getCfbdWeekData).mockResolvedValue([
				{ season: 2025, week: 1, seasonType: 'regular', startDate: '2025-08-23', endDate: '2025-09-01', firstGameStart: '', lastGameStart: '' },
				{ season: 2025, week: 2, seasonType: 'regular', startDate: '2025-09-02', endDate: '2025-09-08', firstGameStart: '', lastGameStart: '' },
				{ season: 2025, week: 16, seasonType: 'regular', startDate: '2025-12-08', endDate: '2025-12-13', firstGameStart: '', lastGameStart: '' },
				{ season: 2025, week: 1, seasonType: 'postseason', startDate: '2025-12-13', endDate: '2026-01-21', firstGameStart: '', lastGameStart: '' },
			]);

			const { getWeekData } = await import('../../../src/api/index.js');
			const weeks = await getWeekData(2025);

			// Regular weeks keep their numbers
			expect(weeks[0].weekNumber).toBe(1);
			expect(weeks[1].weekNumber).toBe(2);
			expect(weeks[2].weekNumber).toBe(16);

			// Postseason week 1 becomes 17 (16 regular + 1)
			expect(weeks[3].weekNumber).toBe(17);
			expect(weeks[3].seasonType).toBe('postseason');
		});
	});

	describe('getGameData - CFBD', () => {
		it('should correctly determine winner when one team scores 0 (shutout)', async () => {
			vi.resetModules();

			const { getCfbdGameData, getCfbdLinesData } = await import('../../../src/api/cfbd.js');
			vi.mocked(getCfbdGameData).mockResolvedValue([
				{
					id: 1,
					completed: true,
					homeTeam: 'Alabama',
					awayTeam: 'Vanderbilt',
					homePoints: 42,
					awayPoints: 0,
					startDate: '2025-09-06T17:00:00.000Z',
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any,
			]);
			vi.mocked(getCfbdLinesData).mockResolvedValue([]);

			const { getGameData } = await import('../../../src/api/index.js');
			const games = await getGameData({ year: 2025, week: 2, seasonType: 'regular' });

			expect(games).toHaveLength(1);
			expect(games[0].winningTeam).toBe('home_team');
			expect(games[0].homePoints).toBe(42);
			expect(games[0].awayPoints).toBe(0);
		});

		it('should leave winningTeam as pending for incomplete games', async () => {
			vi.resetModules();

			const { getCfbdGameData, getCfbdLinesData } = await import('../../../src/api/cfbd.js');
			vi.mocked(getCfbdGameData).mockResolvedValue([
				{
					id: 2,
					completed: false,
					homeTeam: 'Ohio St.',
					awayTeam: 'Michigan',
					homePoints: null,
					awayPoints: null,
					startDate: '2025-11-29T19:00:00.000Z',
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any,
			]);
			vi.mocked(getCfbdLinesData).mockResolvedValue([]);

			const { getGameData } = await import('../../../src/api/index.js');
			const games = await getGameData({ year: 2025, week: 14, seasonType: 'regular' });

			expect(games).toHaveLength(1);
			expect(games[0].winningTeam).toBe('pending');
			expect(games[0].homePoints).toBeNull();
			expect(games[0].awayPoints).toBeNull();
		});

		it('should use consensus line spread when available', async () => {
			vi.resetModules();

			const { getCfbdGameData, getCfbdLinesData } = await import('../../../src/api/cfbd.js');
			vi.mocked(getCfbdGameData).mockResolvedValue([
				{
					id: 10,
					completed: false,
					homeTeam: 'Georgia',
					awayTeam: 'Florida',
					homePoints: null,
					awayPoints: null,
					startDate: '2025-10-25T17:00:00.000Z',
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any,
			]);
			vi.mocked(getCfbdLinesData).mockResolvedValue([
				{
					id: 10,
					season: 2025,
					seasonType: 'regular',
					week: 8,
					startDate: '2025-10-25T17:00:00.000Z',
					homeTeamId: 1,
					homeTeam: 'Georgia',
					homeConference: 'SEC',
					homeClassification: 'fbs',
					homeScore: null,
					awayTeamId: 2,
					awayTeam: 'Florida',
					awayConference: 'SEC',
					awayClassification: 'fbs',
					awayScore: null,
					lines: [
						{ provider: 'DraftKings', spread: -7.5, formattedSpread: 'Georgia -7.5', spreadOpen: null, overUnder: null, overUnderOpen: null, homeMoneyline: null, awayMoneyline: null },
						{ provider: 'consensus', spread: -6.5, formattedSpread: 'Georgia -6.5', spreadOpen: null, overUnder: null, overUnderOpen: null, homeMoneyline: null, awayMoneyline: null },
					],
				},
			]);

			const { getGameData } = await import('../../../src/api/index.js');
			const games = await getGameData({ year: 2025, week: 8, seasonType: 'regular' });

			expect(games).toHaveLength(1);
			expect(games[0].spread).toBe(-6.5); // consensus preferred over DraftKings
		});

		it('should fall back to first line when no consensus line exists', async () => {
			vi.resetModules();

			const { getCfbdGameData, getCfbdLinesData } = await import('../../../src/api/cfbd.js');
			vi.mocked(getCfbdGameData).mockResolvedValue([
				{
					id: 11,
					completed: false,
					homeTeam: 'Alabama',
					awayTeam: 'Auburn',
					homePoints: null,
					awayPoints: null,
					startDate: '2025-11-29T16:00:00.000Z',
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any,
			]);
			vi.mocked(getCfbdLinesData).mockResolvedValue([
				{
					id: 11,
					season: 2025,
					seasonType: 'regular',
					week: 14,
					startDate: '2025-11-29T16:00:00.000Z',
					homeTeamId: 3,
					homeTeam: 'Alabama',
					homeConference: 'SEC',
					homeClassification: 'fbs',
					homeScore: null,
					awayTeamId: 4,
					awayTeam: 'Auburn',
					awayConference: 'SEC',
					awayClassification: 'fbs',
					awayScore: null,
					lines: [
						{ provider: 'ESPN BET', spread: -14, formattedSpread: 'Alabama -14', spreadOpen: null, overUnder: null, overUnderOpen: null, homeMoneyline: null, awayMoneyline: null },
					],
				},
			]);

			const { getGameData } = await import('../../../src/api/index.js');
			const games = await getGameData({ year: 2025, week: 14, seasonType: 'regular' });

			expect(games).toHaveLength(1);
			expect(games[0].spread).toBe(-14); // falls back to first line
		});

		it('should set spread to null when lines array is empty', async () => {
			vi.resetModules();

			const { getCfbdGameData, getCfbdLinesData } = await import('../../../src/api/cfbd.js');
			vi.mocked(getCfbdGameData).mockResolvedValue([
				{
					id: 12,
					completed: false,
					homeTeam: 'App State',
					awayTeam: 'Troy',
					homePoints: null,
					awayPoints: null,
					startDate: '2025-09-20T14:00:00.000Z',
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any,
			]);
			vi.mocked(getCfbdLinesData).mockResolvedValue([
				{
					id: 12,
					season: 2025,
					seasonType: 'regular',
					week: 4,
					startDate: '2025-09-20T14:00:00.000Z',
					homeTeamId: 5,
					homeTeam: 'App State',
					homeConference: 'Sun Belt',
					homeClassification: 'fbs',
					homeScore: null,
					awayTeamId: 6,
					awayTeam: 'Troy',
					awayConference: 'Sun Belt',
					awayClassification: 'fbs',
					awayScore: null,
					lines: [],
				},
			]);

			const { getGameData } = await import('../../../src/api/index.js');
			const games = await getGameData({ year: 2025, week: 4, seasonType: 'regular' });

			expect(games).toHaveLength(1);
			expect(games[0].spread).toBeNull();
		});

		it('should set spread to null when game has no matching lines entry', async () => {
			vi.resetModules();

			const { getCfbdGameData, getCfbdLinesData } = await import('../../../src/api/cfbd.js');
			vi.mocked(getCfbdGameData).mockResolvedValue([
				{
					id: 99,
					completed: false,
					homeTeam: 'SMU',
					awayTeam: 'TCU',
					homePoints: null,
					awayPoints: null,
					startDate: '2025-09-13T15:00:00.000Z',
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				} as any,
			]);
			vi.mocked(getCfbdLinesData).mockResolvedValue([]); // no lines data at all

			const { getGameData } = await import('../../../src/api/index.js');
			const games = await getGameData({ year: 2025, week: 3, seasonType: 'regular' });

			expect(games).toHaveLength(1);
			expect(games[0].spread).toBeNull();
		});
	});

	describe('shared type contracts', () => {
		it('AdminWeekData should not have weekId property', () => {
			const week: AdminWeekData = {
				weekNumber: 1,
				year: 2025,
				seasonType: 'regular',
				weekStart: '2025-08-23',
				weekEnd: '2025-09-01',
			};

			expect(week).not.toHaveProperty('weekId');
		});
	});
});
