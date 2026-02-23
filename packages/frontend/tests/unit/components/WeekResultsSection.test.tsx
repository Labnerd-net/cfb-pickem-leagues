import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils.js';
import WeekResultsSection from '../../../src/components/user/WeekResultsSection.js';
import type { AdminDbGameData, AdminDbWeekData, UserDbGameData } from '@shared/types/cfb-pickem-api';

vi.mock('../../../src/apis/userRequests.js', () => ({
	getPickedGames: vi.fn(),
	getUserPicks: vi.fn(),
	getWeeksForYear: vi.fn(),
}));

import {
	getPickedGames,
	getUserPicks,
	getWeeksForYear,
} from '../../../src/apis/userRequests.js';

const mockGetPickedGames = vi.mocked(getPickedGames);
const mockGetUserPicks = vi.mocked(getUserPicks);
const mockGetWeeksForYear = vi.mocked(getWeeksForYear);

const currentYear = new Date().getFullYear();

const pastDate = (daysAgo: number) => {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	return d.toISOString();
};

const futureDate = (daysAhead: number) => {
	const d = new Date();
	d.setDate(d.getDate() + daysAhead);
	return d.toISOString();
};

function makeWeek(overrides: Partial<AdminDbWeekData> = {}): AdminDbWeekData {
	return {
		weekNumber: 1,
		year: currentYear,
		seasonType: 'regular',
		weekStart: pastDate(14),
		weekEnd: pastDate(7),
		createdAt: new Date(),
		...overrides,
	};
}

function makeGame(overrides: Partial<AdminDbGameData> = {}): AdminDbGameData {
	return {
		gameId: 1,
		cfbdGameId: null,
		ncaaGameId: null,
		picked: true,
		weekNumber: 1,
		year: currentYear,
		seasonType: 'regular',
		completed: true,
		homeTeam: 'Home Team',
		awayTeam: 'Away Team',
		homePoints: 24,
		awayPoints: 17,
		winningTeam: 'home_team',
		startTime: null,
		createdAt: new Date(),
		...overrides,
	};
}

function makeUserPick(overrides: Partial<UserDbGameData> = {}): UserDbGameData {
	return {
		userId: 1,
		gameId: 1,
		cfbdGameId: null,
		ncaaGameId: null,
		weekNumber: 1,
		year: currentYear,
		seasonType: 'regular',
		completed: true,
		homeTeam: 'Home Team',
		awayTeam: 'Away Team',
		homePoints: 24,
		awayPoints: 17,
		winningTeam: 'home_team',
		startTime: null,
		teamChosen: 'home_team',
		createdAt: new Date(),
		...overrides,
	};
}

const defaultWeek = makeWeek();

beforeEach(() => {
	vi.clearAllMocks();
	mockGetWeeksForYear.mockResolvedValue({
		success: true,
		data: { weeks: [defaultWeek] },
	});
	mockGetPickedGames.mockResolvedValue({ success: true, data: [] });
	mockGetUserPicks.mockResolvedValue({ success: true, data: [] });
});

describe('WeekResultsSection', () => {
	it('shows CircularProgress while initializing', () => {
		mockGetWeeksForYear.mockReturnValue(new Promise(() => {}));

		renderWithProviders(<WeekResultsSection />);

		expect(screen.getByRole('progressbar')).toBeInTheDocument();
	});

	it('renders result rows when data is returned', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [makeGame()] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [makeUserPick()] });

		renderWithProviders(<WeekResultsSection />);

		await waitFor(() => {
			expect(screen.getByText('Away Team @ Home Team')).toBeInTheDocument();
		});
	});

	it('shows "Correct" chip for a correct pick', async () => {
		mockGetPickedGames.mockResolvedValue({
			success: true,
			data: [makeGame({ winningTeam: 'home_team' })],
		});
		mockGetUserPicks.mockResolvedValue({
			success: true,
			data: [makeUserPick({ teamChosen: 'home_team' })],
		});

		renderWithProviders(<WeekResultsSection />);

		await waitFor(() => {
			expect(screen.getByText('Correct')).toBeInTheDocument();
		});
	});

	it('shows "Incorrect" chip for a wrong pick', async () => {
		mockGetPickedGames.mockResolvedValue({
			success: true,
			data: [makeGame({ winningTeam: 'home_team' })],
		});
		mockGetUserPicks.mockResolvedValue({
			success: true,
			data: [makeUserPick({ teamChosen: 'away_team' })],
		});

		renderWithProviders(<WeekResultsSection />);

		await waitFor(() => {
			expect(screen.getByText('Incorrect')).toBeInTheDocument();
		});
	});

	it('shows "Pending" chip when winningTeam is pending', async () => {
		mockGetPickedGames.mockResolvedValue({
			success: true,
			data: [makeGame({ completed: false, winningTeam: 'pending', homePoints: null, awayPoints: null })],
		});
		mockGetUserPicks.mockResolvedValue({
			success: true,
			data: [makeUserPick({ teamChosen: 'home_team', winningTeam: 'pending' })],
		});

		renderWithProviders(<WeekResultsSection />);

		await waitFor(() => {
			expect(screen.getByText('Pending')).toBeInTheDocument();
		});
	});

	it('shows "No Pick" chip and italic text when teamChosen is null', async () => {
		mockGetPickedGames.mockResolvedValue({
			success: true,
			data: [makeGame()],
		});
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });

		renderWithProviders(<WeekResultsSection />);

		await waitFor(() => {
			expect(screen.getByText('No Pick')).toBeInTheDocument();
			expect(screen.getByText('No pick made')).toBeInTheDocument();
		});
	});

	it('shows empty state when no games returned', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });

		renderWithProviders(<WeekResultsSection />);

		await waitFor(() => {
			expect(screen.getByText('No games available for this week.')).toBeInTheDocument();
		});
	});

	it('shows error state when fetch fails', async () => {
		mockGetPickedGames.mockResolvedValue({ success: false, error: 'Server error' });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });

		renderWithProviders(<WeekResultsSection />);

		await waitFor(() => {
			expect(screen.getByText('Server error')).toBeInTheDocument();
		});
	});

	it('re-fetches when week selector changes', async () => {
		const week2 = makeWeek({ weekNumber: 2, weekStart: pastDate(21), weekEnd: pastDate(14) });
		mockGetWeeksForYear.mockResolvedValue({
			success: true,
			data: { weeks: [defaultWeek, week2] },
		});
		mockGetPickedGames.mockResolvedValue({ success: true, data: [] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });

		const user = userEvent.setup();
		renderWithProviders(<WeekResultsSection />);

		// Wait for initialization
		await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0));

		// Find and change the Week selector (second combobox)
		const combos = screen.getAllByRole('combobox');
		const weekCombo = combos[1];
		await user.click(weekCombo);

		await waitFor(() => expect(screen.getByRole('option', { name: 'Week 2' })).toBeInTheDocument());
		await user.click(screen.getByRole('option', { name: 'Week 2' }));

		await waitFor(() => {
			const calls = mockGetPickedGames.mock.calls;
			expect(calls.some(c => c[0].week === 2)).toBe(true);
		});
	});
});
