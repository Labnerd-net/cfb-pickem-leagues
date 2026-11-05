import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const demo = vi.hoisted(() => ({ on: false }));
vi.mock('../../../src/lib/demo.js', () => ({
	get IS_DEMO() {
		return demo.on;
	},
	DEMO_DISABLED_NOTE: 'Disabled in the demo.',
}));

import DemoBanner from '../../../src/components/DemoBanner.js';
import DemoDisabledNote from '../../../src/components/DemoDisabledNote.js';

describe('DemoBanner', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2024-07-15T12:00:00Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
		demo.on = false;
	});

	it('renders nothing outside the demo', () => {
		demo.on = false;
		const { container } = render(<DemoBanner />);
		expect(container).toBeEmptyDOMElement();
	});

	it('states it is a demo, the 2024 season, and the midnight Central reset', () => {
		demo.on = true;
		render(<DemoBanner />);
		const banner = screen.getByRole('region', { name: 'Demo notice' });
		expect(banner).toHaveTextContent(/demo/i);
		expect(banner).toHaveTextContent('2024');
		expect(banner).toHaveTextContent(/midnight Central/i);
	});

	it('counts down to the next Chicago midnight using the real clock', () => {
		demo.on = true;
		render(<DemoBanner />);
		// 12:00Z -> next reset 05:00Z the following day = 17h
		expect(screen.getByTestId('demo-reset-countdown')).toHaveTextContent('17h 00m 00s');
		act(() => {
			vi.advanceTimersByTime(3_000);
		});
		expect(screen.getByTestId('demo-reset-countdown')).toHaveTextContent('16h 59m 57s');
	});

	it('shows Resetting… right after the reset time', () => {
		demo.on = true;
		vi.setSystemTime(new Date('2024-07-16T05:00:10Z'));
		render(<DemoBanner />);
		expect(screen.getByTestId('demo-reset-countdown')).toHaveTextContent('Resetting…');
	});
});

describe('DemoDisabledNote', () => {
	afterEach(() => {
		demo.on = false;
	});

	it('shows only in the demo', () => {
		demo.on = false;
		const off = render(<DemoDisabledNote text="Nope." />);
		expect(off.container).toBeEmptyDOMElement();
		off.unmount();

		demo.on = true;
		render(<DemoDisabledNote text="Nope." />);
		expect(screen.getByText('Nope.')).toBeInTheDocument();
	});
});
