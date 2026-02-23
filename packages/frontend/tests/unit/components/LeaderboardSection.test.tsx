import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils.js';
import LeaderboardSection from '../../../src/components/user/LeaderboardSection.js';
import type { LeaderboardEntry } from '@shared/types/cfb-pickem-api';

vi.mock('../../../src/apis/leaderboardRequests.js', () => ({
	getLeaderboard: vi.fn(),
}));

vi.mock('../../../src/contexts/auth/AuthContext', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../src/contexts/auth/AuthContext.js')>();
	return { ...actual, useAuth: vi.fn() };
});

import { getLeaderboard } from '../../../src/apis/leaderboardRequests.js';
import { useAuth } from '../../../src/contexts/auth/AuthContext';

const mockGetLeaderboard = vi.mocked(getLeaderboard);
const mockUseAuth = vi.mocked(useAuth);

const mockEntries: LeaderboardEntry[] = [
	{ userId: 1, displayName: 'Alice', total: 10, correct: 7, incorrect: 3, pending: 0, percentage: 0.7 },
	{ userId: 2, displayName: 'Bob', total: 8, correct: 4, incorrect: 4, pending: 0, percentage: null },
	{ userId: 3, displayName: 'Carol', total: 0, correct: 0, incorrect: 0, pending: 0, percentage: null },
];

const currentYear = new Date().getFullYear();

beforeEach(() => {
	mockUseAuth.mockReturnValue({
		user: { userId: 1, email: 'alice@example.com', displayName: 'Alice', roles: ['user'] },
		isLoading: false,
		login: vi.fn(),
		logout: vi.fn(),
	});
});

describe('LeaderboardSection', () => {
	it('renders ranked table when API returns data', async () => {
		mockGetLeaderboard.mockResolvedValue({ success: true, data: mockEntries });

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
		mockGetLeaderboard.mockResolvedValue({ success: true, data: mockEntries });

		renderWithProviders(<LeaderboardSection />);

		await waitFor(() => {
			expect(screen.getByText('Alice')).toBeInTheDocument();
		});

		const aliceRow = screen.getByText('Alice').closest('tr');
		const bobRow = screen.getByText('Bob').closest('tr');
		expect(aliceRow).not.toBe(bobRow);
	});

	it('renders "—" for a user with percentage: null', async () => {
		mockGetLeaderboard.mockResolvedValue({ success: true, data: mockEntries });

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

	it('renders year selector defaulting to current year', async () => {
		mockGetLeaderboard.mockResolvedValue({ success: true, data: [] });

		renderWithProviders(<LeaderboardSection />);

		expect(screen.getByRole('combobox')).toBeInTheDocument();
		await waitFor(() => {
			expect(mockGetLeaderboard).toHaveBeenCalledWith(currentYear);
		});
	});

	it('re-fetches when year is changed', async () => {
		mockGetLeaderboard.mockResolvedValue({ success: true, data: [] });
		const user = userEvent.setup();

		renderWithProviders(<LeaderboardSection />);

		await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());

		await user.click(screen.getByRole('combobox'));
		await user.click(screen.getByRole('option', { name: String(currentYear - 1) }));

		await waitFor(() => {
			expect(mockGetLeaderboard).toHaveBeenCalledWith(currentYear - 1);
		});
	});
});
