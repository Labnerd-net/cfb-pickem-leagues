import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const demo = vi.hoisted(() => ({ on: false }));
vi.mock('../../../src/lib/demo.js', () => ({
	get IS_DEMO() {
		return demo.on;
	},
	DEMO_DISABLED_NOTE: 'Disabled in the demo.',
}));

const mockDemoLogin = vi.hoisted(() => vi.fn());
vi.mock('../../../src/apis/authRequests.js', async importOriginal => {
	const actual = await importOriginal<typeof import('../../../src/apis/authRequests.js')>();
	return { ...actual, demoLogin: mockDemoLogin };
});

import LoginForm from '../../../src/pages/Login.js';
import { AuthContext } from '../../../src/contexts/auth/AuthContext.js';

function renderLogin(login = vi.fn().mockResolvedValue(undefined)) {
	render(
		<AuthContext.Provider value={{ user: null, isLoading: false, login, logout: vi.fn() }}>
			<MemoryRouter>
				<LoginForm />
			</MemoryRouter>
		</AuthContext.Provider>,
	);
	return login;
}

afterEach(() => {
	demo.on = false;
	vi.clearAllMocks();
});

describe('Login page', () => {
	it('shows the normal form and the sign-up link outside the demo', () => {
		demo.on = false;
		renderLogin();
		expect(screen.getByLabelText('Email')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Sign up' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /sign in as a player/i })).not.toBeInTheDocument();
	});

	it('shows the demo choices, and hides the form and the register link, in the demo', () => {
		demo.on = true;
		renderLogin();
		expect(screen.getByRole('button', { name: /sign in as a player/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /sign in as an admin/i })).toBeInTheDocument();
		expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Sign up' })).not.toBeInTheDocument();
	});

	it('signs in as the chosen demo account', async () => {
		demo.on = true;
		mockDemoLogin.mockResolvedValue({ success: true });
		const login = renderLogin();
		await userEvent.click(screen.getByRole('button', { name: /sign in as an admin/i }));
		await waitFor(() => expect(login).toHaveBeenCalled());
		expect(mockDemoLogin).toHaveBeenCalledWith('admin');
	});

	it('shows the error when demo login fails', async () => {
		demo.on = true;
		mockDemoLogin.mockResolvedValue({ success: false, error: 'Demo data is not seeded' });
		const login = renderLogin();
		await userEvent.click(screen.getByRole('button', { name: /sign in as a player/i }));
		expect(await screen.findByText('Demo data is not seeded')).toBeInTheDocument();
		expect(login).not.toHaveBeenCalled();
	});
});
