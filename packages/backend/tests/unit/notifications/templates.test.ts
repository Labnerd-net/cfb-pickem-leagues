import { describe, it, expect } from 'vitest';
import { picksReminderTemplate, picksReminder24hTemplate, rankingsUpdatedTemplate } from '../../../src/notifications/templates.js';
import type { LeaderboardEntry } from '@shared/types/cfb-pickem-api.js';

describe('picksReminderTemplate', () => {
	it('formats kickoff time in Central Time', () => {
		// 2024-09-07T17:00:00Z = 12:00 PM CDT (UTC-5 in summer)
		const kickoff = new Date('2024-09-07T17:00:00Z');
		const { textBody } = picksReminderTemplate({ year: 2024, weekNumber: 1, leagueName: 'Test League', firstKickoffTime: kickoff });
		// Should contain a Central Time abbreviation (CDT in summer, CST in winter)
		expect(textBody).toMatch(/C[DS]T/);
	});

	it('does not use a server-local timezone without an explicit zone', () => {
		const kickoff = new Date('2024-09-07T17:00:00Z');
		const { textBody } = picksReminderTemplate({ year: 2024, weekNumber: 1, leagueName: 'Test League', firstKickoffTime: kickoff });
		// The time displayed should match Central noon, not UTC 5 PM
		expect(textBody).toContain('12:00');
	});
});

describe('picksReminder24hTemplate', () => {
	it('formats kickoff time in Central Time', () => {
		const kickoff = new Date('2024-09-07T17:00:00Z');
		const { textBody } = picksReminder24hTemplate({ year: 2024, weekNumber: 1, leagueName: 'Test League', firstKickoffTime: kickoff });
		expect(textBody).toMatch(/C[DS]T/);
	});

	it('includes league name in subject', () => {
		const kickoff = new Date('2024-09-07T17:00:00Z');
		const { subject } = picksReminder24hTemplate({ year: 2024, weekNumber: 1, leagueName: 'Rivalry League', firstKickoffTime: kickoff });
		expect(subject).toContain('[Rivalry League]');
		expect(subject).toContain('24 hours');
	});

	it('includes league name in html body', () => {
		const kickoff = new Date('2024-09-07T17:00:00Z');
		const { htmlBody } = picksReminder24hTemplate({ year: 2024, weekNumber: 1, leagueName: 'Test League', firstKickoffTime: kickoff });
		expect(htmlBody).toContain('Test League');
	});
});

function makeEntry(displayName: string): LeaderboardEntry {
	return { userId: 1, displayName, correct: 5, incorrect: 3, pending: 2, total: 10, percentage: 0.5 };
}

describe('rankingsUpdatedTemplate', () => {
	it('escapes < and > in display names', () => {
		const { htmlBody } = rankingsUpdatedTemplate({
			year: 2024,
			weekNumber: 1,
			leagueName: 'Test League',
			leaderboard: [makeEntry('<script>alert(1)</script>')],
		});
		expect(htmlBody).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(htmlBody).not.toContain('<script>');
	});

	it('escapes & in display names', () => {
		const { htmlBody } = rankingsUpdatedTemplate({
			year: 2024,
			weekNumber: 1,
			leagueName: 'Test League',
			leaderboard: [makeEntry('Tom & Jerry')],
		});
		expect(htmlBody).toContain('Tom &amp; Jerry');
		expect(htmlBody).not.toContain('Tom & Jerry');
	});

	it('escapes " and \' in display names', () => {
		const { htmlBody } = rankingsUpdatedTemplate({
			year: 2024,
			weekNumber: 1,
			leagueName: 'Test League',
			leaderboard: [makeEntry('O\'Brien "The Best"')],
		});
		expect(htmlBody).toContain('O&#39;Brien &quot;The Best&quot;');
	});

	it('does not alter normal display names', () => {
		const { htmlBody } = rankingsUpdatedTemplate({
			year: 2024,
			weekNumber: 1,
			leagueName: 'Test League',
			leaderboard: [makeEntry('Alice')],
		});
		expect(htmlBody).toContain('Alice');
	});

	it('does not escape textBody (plain text)', () => {
		const { textBody } = rankingsUpdatedTemplate({
			year: 2024,
			weekNumber: 1,
			leagueName: 'Test League',
			leaderboard: [makeEntry('Tom & Jerry')],
		});
		expect(textBody).toContain('Tom & Jerry');
		expect(textBody).not.toContain('&amp;');
	});
});
