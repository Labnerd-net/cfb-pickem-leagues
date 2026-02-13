import { describe, it, expect } from 'vitest';
import { returnID } from '../../../src/api/index.js';
import type { WeekIdData } from '@shared/types/cfb-pickem-api.js';

describe('API Converters', () => {
	describe('returnID', () => {
		it('should encode regular season week ID correctly', () => {
			const weekData: WeekIdData = {
				year: 2024,
				week: 1,
				seasonType: 'regular',
			};

			const weekId = returnID(weekData);

			// Formula: year * 1000 + adjustment + week
			// Regular season adjustment = 0
			expect(weekId).toBe(2024001);
		});

		it('should encode postseason week ID correctly', () => {
			const weekData: WeekIdData = {
				year: 2024,
				week: 1,
				seasonType: 'postseason',
			};

			const weekId = returnID(weekData);

			// Postseason adjustment = 100
			expect(weekId).toBe(2024101);
		});

		it('should encode other season types correctly', () => {
			const weekData: WeekIdData = {
				year: 2024,
				week: 1,
				seasonType: 'both',
			};

			const weekId = returnID(weekData);

			// Other season types adjustment = 900
			expect(weekId).toBe(2024901);
		});

		it('should handle double-digit week numbers', () => {
			const weekData: WeekIdData = {
				year: 2024,
				week: 15,
				seasonType: 'regular',
			};

			const weekId = returnID(weekData);

			expect(weekId).toBe(2024015);
		});

		it('should handle different years', () => {
			const weekData: WeekIdData = {
				year: 2025,
				week: 5,
				seasonType: 'regular',
			};

			const weekId = returnID(weekData);

			expect(weekId).toBe(2025005);
		});
	});
});
