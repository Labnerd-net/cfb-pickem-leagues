import { describe, it, expect } from 'vitest';
import { rankingsUpdatedTemplate } from '../../../src/notifications/templates.js';
import type { LeaderboardEntry } from '@shared/types/cfb-pickem-api.js';

function makeEntry(displayName: string): LeaderboardEntry {
	return { userId: 1, displayName, correct: 5, incorrect: 3, pending: 2, total: 10, percentage: 0.5 };
}

describe('rankingsUpdatedTemplate', () => {
	it('escapes < and > in display names', () => {
		const { htmlBody } = rankingsUpdatedTemplate({
			year: 2024,
			weekNumber: 1,
			leaderboard: [makeEntry('<script>alert(1)</script>')],
		});
		expect(htmlBody).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(htmlBody).not.toContain('<script>');
	});

	it('escapes & in display names', () => {
		const { htmlBody } = rankingsUpdatedTemplate({
			year: 2024,
			weekNumber: 1,
			leaderboard: [makeEntry('Tom & Jerry')],
		});
		expect(htmlBody).toContain('Tom &amp; Jerry');
		expect(htmlBody).not.toContain('Tom & Jerry');
	});

	it('escapes " and \' in display names', () => {
		const { htmlBody } = rankingsUpdatedTemplate({
			year: 2024,
			weekNumber: 1,
			leaderboard: [makeEntry('O\'Brien "The Best"')],
		});
		expect(htmlBody).toContain('O&#39;Brien &quot;The Best&quot;');
	});

	it('does not alter normal display names', () => {
		const { htmlBody } = rankingsUpdatedTemplate({
			year: 2024,
			weekNumber: 1,
			leaderboard: [makeEntry('Alice')],
		});
		expect(htmlBody).toContain('Alice');
	});

	it('does not escape textBody (plain text)', () => {
		const { textBody } = rankingsUpdatedTemplate({
			year: 2024,
			weekNumber: 1,
			leaderboard: [makeEntry('Tom & Jerry')],
		});
		expect(textBody).toContain('Tom & Jerry');
		expect(textBody).not.toContain('&amp;');
	});
});
