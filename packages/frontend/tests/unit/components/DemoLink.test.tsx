import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const demo = vi.hoisted(() => ({ on: false }));
vi.mock('../../../src/lib/demo.js', () => ({
	get IS_DEMO() {
		return demo.on;
	},
	DEMO_URL: 'https://cfbpickem-demo.labnerd.net/login',
	DEMO_DISABLED_NOTE: 'Disabled in the demo.',
}));

import DemoLink from '../../../src/components/DemoLink.js';

afterEach(() => {
	demo.on = false;
});

describe('DemoLink', () => {
	it('links to the demo login page in a new tab on the real site', () => {
		render(<DemoLink />);
		const link = screen.getByRole('link', { name: /try the live demo/i });
		expect(link).toHaveAttribute('href', 'https://cfbpickem-demo.labnerd.net/login');
		expect(link).toHaveAttribute('target', '_blank');
		expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
	});

	it('is not shown inside the demo itself', () => {
		demo.on = true;
		const { container } = render(<DemoLink />);
		expect(container).toBeEmptyDOMElement();
	});
});
