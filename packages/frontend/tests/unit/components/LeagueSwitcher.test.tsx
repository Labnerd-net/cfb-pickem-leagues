import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeagueSwitcher from '../../../src/components/LeagueSwitcher.js';
import type { LeagueData } from '@shared/types/cfb-pickem-api.js';

vi.mock('../../../src/contexts/LeagueContext.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../src/contexts/LeagueContext.js')>();
	return { ...actual, useLeague: vi.fn() };
});

import { useLeague } from '../../../src/contexts/LeagueContext.js';

const mockUseLeague = vi.mocked(useLeague);

const leagueA: LeagueData = {
	leagueId: 1,
	name: 'Alpha League',
	memberCount: 3,
	createdAt: '2024-01-01T00:00:00.000Z',
	role: 'admin',
};

const leagueB: LeagueData = {
	leagueId: 2,
	name: 'Beta League',
	memberCount: 2,
	createdAt: '2024-01-01T00:00:00.000Z',
	role: 'member',
};

const mockSetActiveLeague = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
});

describe('LeagueSwitcher', () => {
	it('renders nothing when leagues is empty', () => {
		mockUseLeague.mockReturnValue({
			leagues: [],
			activeLeague: null,
			setActiveLeague: mockSetActiveLeague,
			isLoading: false,
			refetchLeagues: vi.fn(),
		});

		const { container } = render(<LeagueSwitcher />);
		expect(container.firstChild).toBeNull();
	});

	it('renders static label when user belongs to exactly one league', () => {
		mockUseLeague.mockReturnValue({
			leagues: [leagueA],
			activeLeague: leagueA,
			setActiveLeague: mockSetActiveLeague,
			isLoading: false,
			refetchLeagues: vi.fn(),
		});

		render(<LeagueSwitcher />);

		expect(screen.getByText('Alpha League')).toBeInTheDocument();
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
	});

	it('renders a dropdown when user belongs to more than one league', () => {
		mockUseLeague.mockReturnValue({
			leagues: [leagueA, leagueB],
			activeLeague: leagueA,
			setActiveLeague: mockSetActiveLeague,
			isLoading: false,
			refetchLeagues: vi.fn(),
		});

		render(<LeagueSwitcher />);

		expect(screen.getByRole('combobox')).toBeInTheDocument();
	});

	it('calls setActiveLeague when a different league is selected from the dropdown', async () => {
		const user = userEvent.setup();

		mockUseLeague.mockReturnValue({
			leagues: [leagueA, leagueB],
			activeLeague: leagueA,
			setActiveLeague: mockSetActiveLeague,
			isLoading: false,
			refetchLeagues: vi.fn(),
		});

		render(<LeagueSwitcher />);

		await user.click(screen.getByRole('combobox'));
		await user.click(screen.getByRole('option', { name: 'Beta League' }));

		expect(mockSetActiveLeague).toHaveBeenCalledWith(leagueB);
	});
});
