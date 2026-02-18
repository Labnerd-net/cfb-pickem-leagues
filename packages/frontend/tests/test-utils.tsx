import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AuthProvider } from '../src/contexts/auth/AuthProvider.js';
import type { ReactElement, ReactNode } from 'react';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
	initialRoute?: string;
	initialEntries?: string[];
}

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
	ui: ReactElement,
	options?: CustomRenderOptions,
) {
	const {
		initialRoute = '/',
		initialEntries = [initialRoute],
		...renderOptions
	} = options || {};

	function Wrapper({ children }: { children: ReactNode }) {
		return (
			<MemoryRouter initialEntries={initialEntries}>
				<AuthProvider>{children}</AuthProvider>
			</MemoryRouter>
		);
	}

	return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from @testing-library/react
// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
export { renderWithProviders as render };
