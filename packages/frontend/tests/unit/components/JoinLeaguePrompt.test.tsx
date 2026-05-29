import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JoinLeaguePrompt from '../../../src/components/JoinLeaguePrompt.js';

vi.mock('../../../src/apis/leagueRequests.js', () => ({
	joinLeague: vi.fn(),
}));

import { joinLeague } from '../../../src/apis/leagueRequests.js';

const mockJoinLeague = vi.mocked(joinLeague);

const mockLeague = {
	leagueId: 2,
	name: 'New League',
	memberCount: 1,
	createdAt: '2024-01-01T00:00:00.000Z',
	role: 'member' as const,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe('JoinLeaguePrompt', () => {
	it('renders heading and invite code input', () => {
		render(<JoinLeaguePrompt onJoined={vi.fn()} />);

		expect(screen.getByText("You're not in any league yet")).toBeInTheDocument();
		expect(screen.getByLabelText('Invite Code')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Join League' })).toBeInTheDocument();
	});

	it('submit button is disabled when invite code is empty', () => {
		render(<JoinLeaguePrompt onJoined={vi.fn()} />);

		expect(screen.getByRole('button', { name: 'Join League' })).toBeDisabled();
	});

	it('calls joinLeague and onJoined on success', async () => {
		const user = userEvent.setup();
		const onJoined = vi.fn().mockResolvedValue(undefined);
		mockJoinLeague.mockResolvedValue({ success: true, data: mockLeague });

		render(<JoinLeaguePrompt onJoined={onJoined} />);

		await user.type(screen.getByLabelText('Invite Code'), 'VALID123');
		await user.click(screen.getByRole('button', { name: 'Join League' }));

		await waitFor(() => {
			expect(mockJoinLeague).toHaveBeenCalledWith('VALID123');
			expect(onJoined).toHaveBeenCalled();
		});
	});

	it('shows "Invalid invite code" error on 404', async () => {
		const user = userEvent.setup();
		mockJoinLeague.mockResolvedValue({ success: false, error: 'Not found', status: 404 });

		render(<JoinLeaguePrompt onJoined={vi.fn()} />);

		await user.type(screen.getByLabelText('Invite Code'), 'BADCODE');
		await user.click(screen.getByRole('button', { name: 'Join League' }));

		await waitFor(() => {
			expect(screen.getByText('Invalid invite code. Please check and try again.')).toBeInTheDocument();
		});
	});

	it('shows already-member error on 409', async () => {
		const user = userEvent.setup();
		mockJoinLeague.mockResolvedValue({ success: false, error: 'Already a member', status: 409 });

		render(<JoinLeaguePrompt onJoined={vi.fn()} />);

		await user.type(screen.getByLabelText('Invite Code'), 'MYCODE');
		await user.click(screen.getByRole('button', { name: 'Join League' }));

		await waitFor(() => {
			expect(screen.getByText("You're already in this league.")).toBeInTheDocument();
		});
	});

	it('shows generic error on other failures', async () => {
		const user = userEvent.setup();
		mockJoinLeague.mockResolvedValue({ success: false, error: 'Server error', status: 500 });

		render(<JoinLeaguePrompt onJoined={vi.fn()} />);

		await user.type(screen.getByLabelText('Invite Code'), 'CODE');
		await user.click(screen.getByRole('button', { name: 'Join League' }));

		await waitFor(() => {
			expect(screen.getByText('Server error')).toBeInTheDocument();
		});
	});
});
