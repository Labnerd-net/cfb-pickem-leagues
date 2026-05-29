import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./tests/setup.ts'],
		exclude: ['**/node_modules/**', '**/dist/**'],
		pool: 'forks',
		// PGlite (WASM Postgres) is memory-heavy per worker; cap concurrency to avoid OOM
		maxWorkers: 4,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'json-summary'],
			exclude: [
				'**/node_modules/**',
				'**/dist/**',
				'**/tests/**',
				'**/*.config.*',
				'**/drizzle/**',
			],
		},
		testTimeout: 10000,
	},
	resolve: {
		alias: {
			'@shared': path.resolve(__dirname, '../shared'),
		},
	},
});
