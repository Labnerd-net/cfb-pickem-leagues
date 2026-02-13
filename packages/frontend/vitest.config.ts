import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./tests/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json-summary'],
			include: ['src/**/*.{ts,tsx}'],
			exclude: [
				'**/node_modules/**',
				'**/dist/**',
				'**/tests/**',
				'**/*.config.*',
				'src/main.tsx',
			],
		},
		testTimeout: 5000,
	},
	resolve: {
		alias: {
			'@shared': path.resolve(__dirname, '../shared'),
		},
	},
});
