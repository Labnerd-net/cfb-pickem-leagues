import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { AdminWeekData } from '@shared/types/cfb-pickem-api';

vi.mock('../../../src/apis/adminRequests.js', () => ({
	addWeeksToYear: vi.fn(),
	getWeeksForYear: vi.fn(),
	deleteYear: vi.fn(),
}));

vi.mock('../../../src/apis/userRequests.js', () => ({
	getWeeksForYear: vi.fn(),
}));

import { getWeeksForYear as getWeeksAsSiteAdmin } from '../../../src/apis/adminRequests.js';
import { getWeeksForYear as getWeeksAsMember } from '../../../src/apis/userRequests.js';
import { useWeekManagement } from '../../../src/components/admin/useWeekManagement.js';

const mockSiteAdmin = vi.mocked(getWeeksAsSiteAdmin);
const mockMember = vi.mocked(getWeeksAsMember);

// Mirrors admin.weeks for 2026 (Mon→Mon weeks after week 2)
const weeks2026: AdminWeekData[] = [
	{ year: 2026, weekNumber: 1, weekStart: '2026-08-29', weekEnd: '2026-09-08', seasonType: 'regular' },
	{ year: 2026, weekNumber: 2, weekStart: '2026-09-08', weekEnd: '2026-09-14', seasonType: 'regular' },
	{ year: 2026, weekNumber: 3, weekStart: '2026-09-14', weekEnd: '2026-09-21', seasonType: 'regular' },
	{ year: 2026, weekNumber: 4, weekStart: '2026-09-21', weekEnd: '2026-09-28', seasonType: 'regular' },
	{ year: 2026, weekNumber: 5, weekStart: '2026-09-28', weekEnd: '2026-10-05', seasonType: 'regular' },
];

// Fake only Date so waitFor's timers still run
function pinNow(iso: string) {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(iso));
}

beforeEach(() => {
	vi.clearAllMocks();
	mockSiteAdmin.mockResolvedValue({ success: true, data: weeks2026 });
	mockMember.mockResolvedValue({ success: true, data: { weeks: weeks2026 } });
});

afterEach(() => {
	vi.useRealTimers();
});

describe('useWeekManagement default week', () => {
	it('defaults site admin controls to the current week', async () => {
		pinNow(new Date(2026, 8, 25, 12).toISOString()); // Fri Sep 25 → week 4
		const { result } = renderHook(() => useWeekManagement(2026));
		await waitFor(() => expect(result.current.weeksChecked).toBe(true));
		expect(result.current.selectedWeek).toBe(4);
	});

	it('defaults league admin controls to the current week', async () => {
		pinNow(new Date(2026, 8, 25, 12).toISOString());
		const { result } = renderHook(() => useWeekManagement(2026, 'member'));
		await waitFor(() => expect(result.current.weeksChecked).toBe(true));
		expect(result.current.selectedWeek).toBe(4);
	});

	it('rolls over on Monday, ahead of the dashboard', async () => {
		pinNow(new Date(2026, 8, 20, 12).toISOString()); // Sun Sep 20 → still week 3
		const first = renderHook(() => useWeekManagement(2026));
		await waitFor(() => expect(first.result.current.weeksChecked).toBe(true));
		expect(first.result.current.selectedWeek).toBe(3);
		first.unmount();

		pinNow(new Date(2026, 8, 21, 0).toISOString()); // Mon Sep 21 midnight → week 4
		const second = renderHook(() => useWeekManagement(2026, 'member'));
		await waitFor(() => expect(second.result.current.weeksChecked).toBe(true));
		expect(second.result.current.selectedWeek).toBe(4);
	});

	it('falls back to the first week when viewing a season that is not current', async () => {
		pinNow(new Date(2027, 4, 1, 12).toISOString()); // May 2027, 2026 season over
		const { result } = renderHook(() => useWeekManagement(2026));
		await waitFor(() => expect(result.current.weeksChecked).toBe(true));
		expect(result.current.selectedWeek).toBe(1);
	});
});
