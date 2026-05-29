import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils.js';
import LeaderboardSection from '../../../src/components/user/LeaderboardSection.js';
import type { LeaderboardEntry, WeekScoresEntry } from '@shared/types/cfb-pickem-api';

vi.mock('../../../src/apis/leaderboardRequests.js', () => ({
	getLeaderboard: vi.fn(),
	getWeekScores: vi.fn(),
}));

vi.mock('../../../src/apis/userRequests.js', () => ({
	getWeeksForYear: vi.fn(),
}));

vi.mock('../../../src/contexts/auth/AuthContext', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../src/contexts/auth/AuthContext.js')>();
	return { ...actual, useAuth: vi.fn() };
});

import { getLeaderboard, getWeekScores } from '../../../src/apis/leaderboardRequests.js';
import { getWeeksForYear } from '../../../src/apis/userRequests.js';
import { useAuth } from '../../../src/contexts/auth/AuthContext';
import { getCurrentSeason } from '../../../src/utils/weekCalculation.js';

const mockGetLeaderboard = vi.mocked(getLeaderboard);
const mockGetWeekScores = vi.mocked(getWeekScores);
const mockGetWeeksForYear = vi.mocked(getWeeksForYear);
const mockUseAuth = vi.mocked(useAuth);

const mockEntries: LeaderboardEntry[] = [
	{ userId: 1, displayName: 'Alice', total: 10, correct: 7, incorrect: 3, pending: 0, percentage: 0.7 },
	{ userId: 2, displayName: 'Bob', total: 8, correct: 4, incorrect: 4, pending: 0, percentage: null },
	{ userId: 3, displayName: 'Carol', total: 0, correct: 0, incorrect: 0, pending: 0, percentage: null },
];

const mockWeekScores: WeekScoresEntry[] = [
	{ userId: 1, displayName: 'Alice', total: 5, correct: 4, incorrect: 1, pending: 0 },
	{ userId: 2, displayName: 'Bob', total: 5, correct: 2, incorrect: 2, pending: 1 },
];

const mockWeeks = [
	{ weekNumber: 1, year: 2025, seasonType: 'regular' as const, weekStart: '2025-08-30', weekEnd: '2025-09-05' },
	{ weekNumber: 2, year: 2025, seasonType: 'regular' as const, weekStart: '2025-09-06', weekEnd: '2025-09-12' },
];

const currentSeason = getCurrentSeason();

beforeEach(() => {
	mockUseAuth.mockReturnValue({
		user: { userId: 1, email: 'alice@example.com', displayName: 'Alice', roles: ['user'], emailVerified: false },
		isLoading: false,
		login: vi.fn(),
		logout: vi.fn(),
	});
	mockGetLeaderboard.mockResolvedValue({ success: true, data: mockEntries });
	mockGetWeeksForYear.mockResolvedValue({ success: true, data: { weeks: mockWeeks } });
	mockGetWeekScores.mockResolvedValue({ success: true, data: mockWeekScores });
});

describe('LeaderboardSection', () => {
	it('renders ranked table when API returns data', async () => {
		renderWithProviders(<LeaderboardSection />);

		await waitFor(() => {
			expect(screen.getByText('Alice')).toBeInTheDocument();
			expect(screen.getByText('Bob')).toBeInTheDocument();
			expect(screen.getByText('Carol')).toBeInTheDocument();
		});

		expect(screen.getByText('1')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
	});

	it('highlights the current user row', async () => {
		renderWithProviders(<LeaderboardSection />);

		await waitFor(() => {
			expect(screen.getByText('Alice')).toBeInTheDocument();
		});

		const aliceRow = screen.getByText('Alice').closest('tr');
		const bobRow = screen.getByText('Bob').closest('tr');
		expect(aliceRow).not.toBe(bobRow);
	});

	it('renders "—" for a user with percentage: null', async () => {
		renderWithProviders(<LeaderboardSection />);

		await waitFor(() => {
			expect(screen.getAllByText('—')).toHaveLength(2);
		});
	});

	it('shows CircularProgress while request is in flight', () => {
		mockGetLeaderboard.mockReturnValue(new Promise(() => {}));

		renderWithProviders(<LeaderboardSection />);

		expect(screen.getByRole('progressbar')).toBeInTheDocument();
	});

	it('shows error message when API call fails', async () => {
		mockGetLeaderboard.mockResolvedValue({ success: false, error: 'Server error' });

		renderWithProviders(<LeaderboardSection />);

		await waitFor(() => {
			expect(screen.getByText('Server error')).toBeInTheDocument();
		});
	});

	it('shows empty-state message when leaderboard array is empty', async () => {
		mockGetLeaderboard.mockResolvedValue({ success: true, data: [] });

		renderWithProviders(<LeaderboardSection />);

		await waitFor(() => {
			expect(screen.getByText('No standings yet for this season.')).toBeInTheDocument();
		});
	});

	it('renders season selector defaulting to current season', async () => {
		renderWithProviders(<LeaderboardSection />);

		await waitFor(() => {
			expect(mockGetLeaderboard).toHaveBeenCalledWith(currentSeason, 1);
		});
	});

	it('re-fetches when season is changed', async () => {
		const user = userEvent.setup();

		renderWithProviders(<LeaderboardSection />);

		await waitFor(() => expect(screen.getByLabelText('Season')).toBeInTheDocument());

		await user.click(screen.getByLabelText('Season'));
		await user.click(screen.getByRole('option', { name: `${currentSeason - 1} Season` }));

		await waitFor(() => {
			expect(mockGetLeaderboard).toHaveBeenCalledWith(currentSeason - 1, 1);
		});
	});

	it('defaults to Season tab', () => {
		renderWithProviders(<LeaderboardSection />);

		expect(screen.getByRole('tab', { name: 'Season' })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'false');
	});

	it('shows week selectors after clicking Week tab', async () => {
		const user = userEvent.setup();

		renderWithProviders(<LeaderboardSection />);

		await user.click(screen.getByRole('tab', { name: 'Week' }));

		await waitFor(() => {
			expect(screen.getByLabelText('Week')).toBeInTheDocument();
		});
	});

	it('loads and renders week scores after switching to Week tab', async () => {
		const user = userEvent.setup();

		renderWithProviders(<LeaderboardSection />);

		await user.click(screen.getByRole('tab', { name: 'Week' }));

		await waitFor(() => {
			expect(screen.getByText('Alice')).toBeInTheDocument();
			expect(screen.getByText('Bob')).toBeInTheDocument();
		});

		expect(screen.getByText('Correct')).toBeInTheDocument();
		expect(screen.getByText('Incorrect')).toBeInTheDocument();
		expect(screen.getByText('Pending')).toBeInTheDocument();
	});

	it('shows week scores error when fetch fails', async () => {
		mockGetWeekScores.mockResolvedValue({ success: false, error: 'Scores unavailable' });
		const user = userEvent.setup();

		renderWithProviders(<LeaderboardSection />);

		await user.click(screen.getByRole('tab', { name: 'Week' }));

		await waitFor(() => {
			expect(screen.getByText('Scores unavailable')).toBeInTheDocument();
		});
	});

	it('shows empty-state message when week scores array is empty', async () => {
		mockGetWeekScores.mockResolvedValue({ success: true, data: [] });
		const user = userEvent.setup();

		renderWithProviders(<LeaderboardSection />);

		await user.click(screen.getByRole('tab', { name: 'Week' }));

		await waitFor(() => {
			expect(screen.getByText('No results for this week yet.')).toBeInTheDocument();
		});
	});

	it('derives percentage for week scores', async () => {
		const user = userEvent.setup();

		renderWithProviders(<LeaderboardSection />);

		await user.click(screen.getByRole('tab', { name: 'Week' }));

		await waitFor(() => {
			expect(screen.getByText('80%')).toBeInTheDocument(); // Alice: 4/5
			expect(screen.getByText('40%')).toBeInTheDocument(); // Bob: 2/5
		});
	});
});
