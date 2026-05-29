import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JoinLeagueDialog from '../../../src/components/JoinLeagueDialog.js';

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

describe('JoinLeagueDialog', () => {
	it('renders dialog with invite code input when open', () => {
		render(<JoinLeagueDialog open onClose={vi.fn()} onJoined={vi.fn()} />);

		expect(screen.getByText('Join a League')).toBeInTheDocument();
		expect(screen.getByLabelText('Invite Code')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
	});

	it('does not render when closed', () => {
		render(<JoinLeagueDialog open={false} onClose={vi.fn()} onJoined={vi.fn()} />);

		expect(screen.queryByText('Join a League')).not.toBeInTheDocument();
	});

	it('Join button is disabled when invite code is empty', () => {
		render(<JoinLeagueDialog open onClose={vi.fn()} onJoined={vi.fn()} />);

		expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
	});

	it('calls joinLeague, onJoined, and onClose on success', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onJoined = vi.fn().mockResolvedValue(undefined);
		mockJoinLeague.mockResolvedValue({ success: true, data: mockLeague });

		render(<JoinLeagueDialog open onClose={onClose} onJoined={onJoined} />);

		await user.type(screen.getByLabelText('Invite Code'), 'VALID123');
		await user.click(screen.getByRole('button', { name: 'Join' }));

		await waitFor(() => {
			expect(mockJoinLeague).toHaveBeenCalledWith('VALID123');
			expect(onJoined).toHaveBeenCalled();
			expect(onClose).toHaveBeenCalled();
		});
	});

	it('shows "Invalid invite code" error on 404', async () => {
		const user = userEvent.setup();
		mockJoinLeague.mockResolvedValue({ success: false, error: 'Not found', status: 404 });

		render(<JoinLeagueDialog open onClose={vi.fn()} onJoined={vi.fn()} />);

		await user.type(screen.getByLabelText('Invite Code'), 'BADCODE');
		await user.click(screen.getByRole('button', { name: 'Join' }));

		await waitFor(() => {
			expect(screen.getByText('Invalid invite code. Please check and try again.')).toBeInTheDocument();
		});
	});

	it('shows already-member error on 409', async () => {
		const user = userEvent.setup();
		mockJoinLeague.mockResolvedValue({ success: false, error: 'Already a member', status: 409 });

		render(<JoinLeagueDialog open onClose={vi.fn()} onJoined={vi.fn()} />);

		await user.type(screen.getByLabelText('Invite Code'), 'CODE');
		await user.click(screen.getByRole('button', { name: 'Join' }));

		await waitFor(() => {
			expect(screen.getByText("You're already in this league.")).toBeInTheDocument();
		});
	});

	it('calls onClose when Cancel is clicked', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<JoinLeagueDialog open onClose={onClose} onJoined={vi.fn()} />);

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(onClose).toHaveBeenCalled();
	});
});
