import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetUserPicks = vi.hoisted(() => vi.fn());
const mockPostUserPicks = vi.hoisted(() => vi.fn());
vi.mock('../../../src/apis/userRequests.js', () => ({
	getUserPicks: mockGetUserPicks,
	postUserPicks: mockPostUserPicks,
}));
vi.mock('../../../src/contexts/LeagueContext.js', () => ({
	useLeague: () => ({ activeLeague: { leagueId: 1 } }),
}));

import { usePickSubmit } from '../../../src/components/user/usePickSubmit.js';
import type { AdminGameWire } from '../../../src/apis/userRequests.js';

const game = (gameId: number, startTime: string) =>
	({ gameId, startTime, homeTeam: 'H', awayTeam: 'A' }) as unknown as AdminGameWire;

// Both games kick off in September 2024, long before the real current date.
const games = [game(1, '2024-09-21T18:30:00Z'), game(2, '2024-09-21T22:00:00Z')];

beforeEach(() => {
	vi.clearAllMocks();
	mockGetUserPicks.mockResolvedValue({
		success: true,
		data: [
			{ gameId: 1, teamChosen: 'home_team' },
			{ gameId: 2, teamChosen: 'away_team' },
		],
	});
	mockPostUserPicks.mockResolvedValue({ success: true });
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.mocked(localStorage.getItem).mockReset();
});

async function setup() {
	const hook = renderHook(() => usePickSubmit({ selectedYear: 2024, selectedWeek: 4, games }));
	await waitFor(() => expect(hook.result.current.userPicks.size).toBe(2));
	return hook;
}

describe('usePickSubmit — deadline check uses the app clock', () => {
	it('submits picks for games that are still open on the pinned clock', async () => {
		// Pinned to before kickoff, like the demo (real time is long after these games).
		vi.mocked(localStorage.getItem).mockImplementation(key =>
			key === 'devCurrentTime' ? '2024-09-18T15:00:00Z' : null,
		);
		const { result } = await setup();
		await act(async () => {
			await result.current.handleSubmit();
		});
		expect(mockPostUserPicks).toHaveBeenCalledTimes(1);
		expect(mockPostUserPicks.mock.calls[0][0].games).toHaveLength(2);
		expect(result.current.snackbar.message).toBe('Picks saved successfully!');
	});

	it('refuses to submit when the pinned clock is past every kickoff', async () => {
		vi.mocked(localStorage.getItem).mockImplementation(key =>
			key === 'devCurrentTime' ? '2024-09-22T00:00:00Z' : null,
		);
		const { result } = await setup();
		await act(async () => {
			await result.current.handleSubmit();
		});
		expect(mockPostUserPicks).not.toHaveBeenCalled();
		expect(result.current.snackbar.message).toMatch(/already started/);
	});
});
