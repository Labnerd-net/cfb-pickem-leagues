import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdminWeekData } from '@shared/types/cfb-pickem-api.js';

// Mock the external API modules and env vars before importing getWeekData
vi.mock('../../../src/utils/envVars.js', () => ({
	dataSource: 'cfbd',
}));

vi.mock('../../../src/api/cfbd.js', () => ({
	getCfbdWeekData: vi.fn(),
	getCfbdGameData: vi.fn(),
}));

vi.mock('../../../src/api/ncaa-api.js', () => ({
	getNcaaSchedule: vi.fn(),
	getNcaaScoreboard: vi.fn(),
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

	describe('getWeekData - NCAA', () => {
		it('should filter out the aggregate summary row', async () => {
			vi.resetModules();

			// Re-mock with NCAA data source
			vi.doMock('../../../src/utils/envVars.js', () => ({
				dataSource: 'ncaa',
			}));

			const { getNcaaSchedule } = await import('../../../src/api/ncaa-api.js');
			vi.mocked(getNcaaSchedule).mockResolvedValue({
				data: {
					schedules: {
						games: [
							{ count: 96, contestDate: '08/23/2025-09/01/2025' },
							{ count: 83, contestDate: '09/05/2025-09/07/2025' },
							{ count: 47, contestDate: '12/13/2025-01/19/2026' }, // aggregate row
						],
						today: { date: '2026/P', week: 3, season: 2025 },
					},
				},
			});

			const { getWeekData } = await import('../../../src/api/index.js');
			const weeks = await getWeekData(2025);

			// Should only have 2 weeks (aggregate row filtered out)
			expect(weeks.length).toBe(2);
			expect(weeks[0].weekNumber).toBe(1);
			expect(weeks[1].weekNumber).toBe(2);
		});

		it('should use sequential index as weekNumber', async () => {
			vi.resetModules();

			vi.doMock('../../../src/utils/envVars.js', () => ({
				dataSource: 'ncaa',
			}));

			const { getNcaaSchedule } = await import('../../../src/api/ncaa-api.js');
			vi.mocked(getNcaaSchedule).mockResolvedValue({
				data: {
					schedules: {
						games: [
							{ count: 96, contestDate: '08/23/2025-09/01/2025' },
							{ count: 83, contestDate: '09/05/2025-09/07/2025' },
							{ count: 70, contestDate: '09/11/2025-09/14/2025' },
							{ count: 47, contestDate: '12/13/2025-01/19/2026' }, // aggregate
						],
						today: { date: '2026/P', week: 4, season: 2025 },
					},
				},
			});

			const { getWeekData } = await import('../../../src/api/index.js');
			const weeks = await getWeekData(2025);

			expect(weeks.length).toBe(3);
			expect(weeks[0].weekNumber).toBe(1);
			expect(weeks[1].weekNumber).toBe(2);
			expect(weeks[2].weekNumber).toBe(3);
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
