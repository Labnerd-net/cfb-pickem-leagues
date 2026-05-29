import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Settings from '../../../src/pages/Settings.js';
import { AuthContext } from '../../../src/contexts/auth/AuthContext.js';
import { LeagueProvider } from '../../../src/contexts/LeagueContext.js';
import type { ProfileData } from '@shared/types/cfb-pickem-api.js';

// Mock userRequests so we can control getNotificationSettings and getBroadcastChannels
const mockGetNotificationSettings = vi.hoisted(() =>
	vi.fn().mockResolvedValue({
		success: true,
		data: { preferences: [], emailVerified: true },
	})
);
const mockGetBroadcastChannels = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ success: true, data: { ntfy: null, telegram: null, discord: null } })
);

vi.mock('../../../src/apis/userRequests.js', async importOriginal => {
	const actual = await importOriginal<typeof import('../../../src/apis/userRequests.js')>();
	return {
		...actual,
		getNotificationSettings: mockGetNotificationSettings,
		getBroadcastChannels: mockGetBroadcastChannels,
	};
});

const mockUser: ProfileData = {
	userId: 1,
	email: 'test@example.com',
	displayName: 'Test User',
	roles: ['user'],
	emailVerified: true,
};

function renderWithAuth(ui: React.ReactElement) {
	return render(
		<AuthContext.Provider
			value={{
				user: mockUser,
				isLoading: false,
				login: vi.fn(),
				logout: vi.fn(),
			}}
		>
			<LeagueProvider>{ui}</LeagueProvider>
		</AuthContext.Provider>
	);
}

describe('Settings page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetNotificationSettings.mockResolvedValue({
			success: true,
			data: { preferences: [], emailVerified: true },
		});
		mockGetBroadcastChannels.mockResolvedValue({
			success: true,
			data: { ntfy: null, telegram: null, discord: null },
		});
	});

	it('renders notification checkboxes after successful load', async () => {
		renderWithAuth(<Settings />);

		// Spinner visible initially
		expect(screen.getByRole('progressbar')).toBeInTheDocument();

		// Spinner goes away after load
		await waitFor(() => {
			expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
		});

		// Notification checkboxes are rendered
		expect(screen.getByLabelText('Games Ready')).toBeInTheDocument();
		expect(screen.getByLabelText('Picks Reminder (1hr before kickoff)')).toBeInTheDocument();
		expect(screen.getByLabelText('Rankings Updated')).toBeInTheDocument();
	});

	it('shows error message and removes spinner when a load function throws', async () => {
		mockGetNotificationSettings.mockRejectedValue(new Error('network error'));

		renderWithAuth(<Settings />);

		await waitFor(() => {
			expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
		});

		expect(
			screen.getByText('Failed to load settings. Please refresh the page.')
		).toBeInTheDocument();

		// Checkboxes are not shown on error
		expect(screen.queryByLabelText('Games Ready')).not.toBeInTheDocument();
	});
});
