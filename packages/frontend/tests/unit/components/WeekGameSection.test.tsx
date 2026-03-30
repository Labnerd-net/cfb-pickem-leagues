import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils.js';
import WeekGameSection from '../../../src/components/user/WeekGameSection.js';
import type { AdminWeekData } from '@shared/types/cfb-pickem-api';
import type { AdminGameWire, UserPickWire } from '../../../src/apis/userRequests.js';

vi.mock('../../../src/apis/userRequests.js', () => ({
	getPickedGames: vi.fn(),
	getUserPicks: vi.fn(),
	getWeeksForYear: vi.fn(),
	postUserPicks: vi.fn(),
}));

vi.mock('../../../src/components/user/useCountdownTick.js', () => ({
	useCountdownTick: vi.fn(),
}));

import {
	getPickedGames,
	getUserPicks,
	getWeeksForYear,
	postUserPicks,
} from '../../../src/apis/userRequests.js';
import { useCountdownTick } from '../../../src/components/user/useCountdownTick.js';

const mockGetPickedGames = vi.mocked(getPickedGames);
const mockGetUserPicks = vi.mocked(getUserPicks);
const mockGetWeeksForYear = vi.mocked(getWeeksForYear);
const mockPostUserPicks = vi.mocked(postUserPicks);
const mockUseCountdownTick = vi.mocked(useCountdownTick);

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

function makeWeek(overrides: Partial<AdminWeekData> = {}): AdminWeekData {
	return {
		weekNumber: 1,
		year: currentYear,
		seasonType: 'regular',
		weekStart: pastDate(14),
		weekEnd: pastDate(7),
		...overrides,
	};
}

function makeGame(overrides: Partial<AdminGameWire> = {}): AdminGameWire {
	return {
		gameId: 1,
		cfbdGameId: null,
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
		spread: null,
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

function makeUserPick(overrides: Partial<UserPickWire> = {}): UserPickWire {
	return {
		userId: 1,
		gameId: 1,
		cfbdGameId: null,
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
		createdAt: new Date().toISOString(),
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
	// Default: far-future `now` so the warning dialog does not appear in non-dialog tests
	mockUseCountdownTick.mockReturnValue(new Date('2025-01-01T00:00:00.000Z'));
});

// ---------------------------------------------------------------------------
// Results mode
// ---------------------------------------------------------------------------

describe('WeekGameSection (results mode)', () => {
	it('shows CircularProgress while initializing', () => {
		mockGetWeeksForYear.mockReturnValue(new Promise(() => {}));

		renderWithProviders(<WeekGameSection />);

		expect(screen.getByRole('progressbar')).toBeInTheDocument();
	});

	it('renders result rows when data is returned', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [makeGame()] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [makeUserPick()] });

		renderWithProviders(<WeekGameSection />);

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

		renderWithProviders(<WeekGameSection />);

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

		renderWithProviders(<WeekGameSection />);

		await waitFor(() => {
			expect(screen.getByText('Incorrect')).toBeInTheDocument();
		});
	});

	it('shows "Pending" chip when winningTeam is pending and game has started', async () => {
		mockGetPickedGames.mockResolvedValue({
			success: true,
			data: [makeGame({ completed: false, winningTeam: 'pending', homePoints: null, awayPoints: null, startTime: pastDate(1) })],
		});
		mockGetUserPicks.mockResolvedValue({
			success: true,
			data: [makeUserPick({ teamChosen: 'home_team', winningTeam: 'pending' })],
		});

		renderWithProviders(<WeekGameSection />);

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

		renderWithProviders(<WeekGameSection />);

		await waitFor(() => {
			expect(screen.getByText('No Pick')).toBeInTheDocument();
			expect(screen.getByText('No pick made')).toBeInTheDocument();
		});
	});

	it('shows empty state when no games returned', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });

		renderWithProviders(<WeekGameSection />);

		await waitFor(() => {
			expect(screen.getByText('No games available for this week. Check back later!')).toBeInTheDocument();
		});
	});

	it('shows error state when fetch fails', async () => {
		mockGetPickedGames.mockResolvedValue({ success: false, error: 'Server error' });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });

		renderWithProviders(<WeekGameSection />);

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
		renderWithProviders(<WeekGameSection />);

		await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0));

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

// ---------------------------------------------------------------------------
// Picks mode
// ---------------------------------------------------------------------------

describe('WeekGameSection (picks mode)', () => {
	const openGame = makeGame({
		completed: false,
		winningTeam: 'pending',
		homePoints: null,
		awayPoints: null,
		startTime: futureDate(3),
	});

	it('renders radio buttons for team selection when games have not started', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [openGame] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });

		renderWithProviders(<WeekGameSection />);

		await waitFor(() => {
			expect(screen.getByRole('radio', { name: 'Away Team' })).toBeInTheDocument();
			expect(screen.getByRole('radio', { name: 'Home Team' })).toBeInTheDocument();
		});
	});

	it('pre-selects a saved pick', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [openGame] });
		mockGetUserPicks.mockResolvedValue({
			success: true,
			data: [makeUserPick({ teamChosen: 'home_team', completed: false, winningTeam: 'pending', homePoints: null, awayPoints: null })],
		});

		renderWithProviders(<WeekGameSection />);

		await waitFor(() => {
			expect(screen.getByRole('radio', { name: 'Home Team' })).toBeChecked();
		});
	});

	it('calls postUserPicks and shows success snackbar on submit', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [openGame] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });
		mockPostUserPicks.mockResolvedValue({ success: true, data: { status: 'ok' } });

		const user = userEvent.setup();
		renderWithProviders(<WeekGameSection />);

		await waitFor(() => expect(screen.getByRole('radio', { name: 'Away Team' })).toBeInTheDocument());

		await user.click(screen.getByRole('radio', { name: 'Away Team' }));
		await user.click(screen.getByRole('button', { name: /submit all picks/i }));

		await waitFor(() => {
			expect(mockPostUserPicks).toHaveBeenCalled();
			expect(screen.getByText('Picks saved successfully!')).toBeInTheDocument();
		});
	});

	it('shows error snackbar when submit fails', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [openGame] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });
		mockPostUserPicks.mockResolvedValue({ success: false, error: 'Failed to save picks' });

		const user = userEvent.setup();
		renderWithProviders(<WeekGameSection />);

		await waitFor(() => expect(screen.getByRole('radio', { name: 'Away Team' })).toBeInTheDocument());

		await user.click(screen.getByRole('radio', { name: 'Away Team' }));
		await user.click(screen.getByRole('button', { name: /submit all picks/i }));

		await waitFor(() => {
			expect(screen.getByText('Failed to save picks')).toBeInTheDocument();
		});
	});
});

// ---------------------------------------------------------------------------
// Mode switching
// ---------------------------------------------------------------------------

describe('WeekGameSection (mode switching)', () => {
	const completedGame = makeGame({ weekNumber: 1 });
	const openGame = makeGame({
		gameId: 2,
		weekNumber: 2,
		completed: false,
		winningTeam: 'pending',
		homePoints: null,
		awayPoints: null,
		startTime: futureDate(3),
	});

	it('transitions from results mode to picks mode when switching to an open week', async () => {
		const week1 = makeWeek({ weekNumber: 1 });
		const week2 = makeWeek({ weekNumber: 2, weekStart: pastDate(3), weekEnd: pastDate(1) });

		mockGetWeeksForYear.mockResolvedValue({ success: true, data: { weeks: [week1, week2] } });
		mockGetPickedGames
			.mockResolvedValueOnce({ success: true, data: [completedGame] })
			.mockResolvedValueOnce({ success: true, data: [openGame] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });

		const user = userEvent.setup();
		renderWithProviders(<WeekGameSection />);

		await waitFor(() => expect(screen.getByText('No Pick')).toBeInTheDocument());

		const combos = screen.getAllByRole('combobox');
		await user.click(combos[1]);
		await waitFor(() => expect(screen.getByRole('option', { name: 'Week 2' })).toBeInTheDocument());
		await user.click(screen.getByRole('option', { name: 'Week 2' }));

		await waitFor(() => {
			expect(screen.getByRole('radio', { name: 'Away Team' })).toBeInTheDocument();
		});
	});

	it('transitions from picks mode to results mode when switching to a completed week', async () => {
		const week1 = makeWeek({ weekNumber: 1, weekStart: pastDate(3), weekEnd: futureDate(4) });
		const week2 = makeWeek({ weekNumber: 2, weekStart: pastDate(14), weekEnd: pastDate(7) });

		mockGetWeeksForYear.mockResolvedValue({ success: true, data: { weeks: [week1, week2] } });
		mockGetPickedGames
			.mockResolvedValueOnce({ success: true, data: [openGame] })
			.mockResolvedValueOnce({ success: true, data: [completedGame] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });

		const user = userEvent.setup();
		renderWithProviders(<WeekGameSection />);

		await waitFor(() => expect(screen.getByRole('radio', { name: 'Away Team' })).toBeInTheDocument());

		const combos = screen.getAllByRole('combobox');
		await user.click(combos[1]);
		await waitFor(() => expect(screen.getByRole('option', { name: 'Week 2' })).toBeInTheDocument());
		await user.click(screen.getByRole('option', { name: 'Week 2' }));

		await waitFor(() => {
			expect(screen.getByText('No Pick')).toBeInTheDocument();
		});
	});
});

// ---------------------------------------------------------------------------
// Lock warning dialog
// ---------------------------------------------------------------------------

describe('WeekGameSection (lock warning dialog)', () => {
	// nearStartTime must be in the REAL future so isResultsMode (which calls getNow()) returns false.
	// fakeNow is set close to nearStartTime so the 15-minute warning threshold is met.
	const fakeNow = new Date();
	const nearStartTime = new Date(fakeNow.getTime() + 8 * 60 * 1000).toISOString(); // 8 min from now

	const nearGame = makeGame({
		completed: false,
		winningTeam: 'pending',
		homePoints: null,
		awayPoints: null,
		startTime: nearStartTime,
	});

	it('shows the warning dialog when unsaved picks exist and deadline is near', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [nearGame] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });
		mockUseCountdownTick.mockReturnValue(fakeNow);

		const user = userEvent.setup();
		renderWithProviders(<WeekGameSection />);

		await waitFor(() => expect(screen.getByRole('radio', { name: 'Away Team' })).toBeInTheDocument());
		await user.click(screen.getByRole('radio', { name: 'Away Team' }));

		await waitFor(() => {
			expect(screen.getByText(/Picks deadline approaching/i)).toBeInTheDocument();
		});
	});

	it('closes the dialog and submits when Submit Now is clicked', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [nearGame] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });
		mockPostUserPicks.mockResolvedValue({ success: true, data: { status: 'ok' } });
		mockUseCountdownTick.mockReturnValue(fakeNow);

		const user = userEvent.setup();
		renderWithProviders(<WeekGameSection />);

		await waitFor(() => expect(screen.getByRole('radio', { name: 'Away Team' })).toBeInTheDocument());
		await user.click(screen.getByRole('radio', { name: 'Away Team' }));

		await waitFor(() => expect(screen.getByText(/Picks deadline approaching/i)).toBeInTheDocument());

		await user.click(screen.getByRole('button', { name: /submit now/i }));

		await waitFor(() => {
			expect(mockPostUserPicks).toHaveBeenCalled();
			expect(screen.queryByText(/Picks deadline approaching/i)).not.toBeInTheDocument();
		});
	});

	it('closes the dialog and does not reopen after Dismiss', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [nearGame] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });
		mockUseCountdownTick.mockReturnValue(fakeNow);

		const user = userEvent.setup();
		renderWithProviders(<WeekGameSection />);

		await waitFor(() => expect(screen.getByRole('radio', { name: 'Away Team' })).toBeInTheDocument());
		await user.click(screen.getByRole('radio', { name: 'Away Team' }));

		await waitFor(() => expect(screen.getByText(/Picks deadline approaching/i)).toBeInTheDocument());

		await user.click(screen.getByRole('button', { name: /dismiss/i }));
		await waitFor(() => expect(screen.queryByText(/Picks deadline approaching/i)).not.toBeInTheDocument());

		// Interact again — dialog must not reappear
		await user.click(screen.getByRole('radio', { name: 'Home Team' }));
		expect(screen.queryByText(/Picks deadline approaching/i)).not.toBeInTheDocument();
	});

	it('does not show the dialog when all picks are already saved', async () => {
		mockGetPickedGames.mockResolvedValue({ success: true, data: [nearGame] });
		mockGetUserPicks.mockResolvedValue({
			success: true,
			data: [makeUserPick({ teamChosen: 'home_team', completed: false, winningTeam: 'pending', homePoints: null, awayPoints: null, startTime: nearStartTime })],
		});
		mockUseCountdownTick.mockReturnValue(fakeNow);

		renderWithProviders(<WeekGameSection />);

		await waitFor(() => expect(screen.getByRole('radio', { name: 'Home Team' })).toBeChecked());
		expect(screen.queryByText(/Picks deadline approaching/i)).not.toBeInTheDocument();
	});

	it('does not show the dialog when VITE_IGNORE_PICK_DEADLINE is true', async () => {
		const original = import.meta.env.VITE_IGNORE_PICK_DEADLINE;
		import.meta.env.VITE_IGNORE_PICK_DEADLINE = 'true';

		mockGetPickedGames.mockResolvedValue({ success: true, data: [nearGame] });
		mockGetUserPicks.mockResolvedValue({ success: true, data: [] });
		mockUseCountdownTick.mockReturnValue(fakeNow);

		const user = userEvent.setup();
		renderWithProviders(<WeekGameSection />);

		await waitFor(() => expect(screen.getByRole('radio', { name: 'Away Team' })).toBeInTheDocument());
		await user.click(screen.getByRole('radio', { name: 'Away Team' }));

		expect(screen.queryByText(/Picks deadline approaching/i)).not.toBeInTheDocument();

		import.meta.env.VITE_IGNORE_PICK_DEADLINE = original;
	});
});
