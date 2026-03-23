import { describe, it, expect } from 'vitest';
import {
	shouldSendPicksReminder,
	shouldRefreshScores,
	isWeekComplete,
	getFirstKickoff,
	getLastKickoff,
} from '../../src/cron/cronLogic.js';
import type { AdminDbGameData } from '@shared/types/cfb-pickem-api.js';

function makeGame(overrides: Partial<AdminDbGameData> = {}): AdminDbGameData {
	return {
		gameId: 1,
		cfbdGameId: null,
		picked: true,
		weekNumber: 1,
		year: 2024,
		seasonType: 'regular',
		completed: false,
		homeTeam: 'Team A',
		awayTeam: 'Team B',
		homePoints: null,
		awayPoints: null,
		winningTeam: 'pending',
		startTime: null,
		spread: null,
		createdAt: new Date(),
		...overrides,
	};
}

const KICKOFF = new Date('2024-09-07T17:00:00Z');

describe('shouldSendPicksReminder', () => {
	it('returns true when now is within the 75-60 min window', () => {
		const now = new Date(KICKOFF.getTime() - 65 * 60 * 1000); // 65 min before
		expect(shouldSendPicksReminder({ now, firstKickoff: KICKOFF })).toBe(true);
	});

	it('returns false when too early (before 75min window)', () => {
		const now = new Date(KICKOFF.getTime() - 80 * 60 * 1000);
		expect(shouldSendPicksReminder({ now, firstKickoff: KICKOFF })).toBe(false);
	});

	it('returns false when too late (after 60min window)', () => {
		const now = new Date(KICKOFF.getTime() - 55 * 60 * 1000);
		expect(shouldSendPicksReminder({ now, firstKickoff: KICKOFF })).toBe(false);
	});

	it('returns true at window start boundary (exactly -75min)', () => {
		const now = new Date(KICKOFF.getTime() - 75 * 60 * 1000);
		expect(shouldSendPicksReminder({ now, firstKickoff: KICKOFF })).toBe(true);
	});

	it('returns true at window end boundary (exactly -60min)', () => {
		const now = new Date(KICKOFF.getTime() - 60 * 60 * 1000);
		expect(shouldSendPicksReminder({ now, firstKickoff: KICKOFF })).toBe(true);
	});

	it('returns false when firstKickoff is null', () => {
		expect(shouldSendPicksReminder({ now: new Date(), firstKickoff: null })).toBe(false);
	});
});

describe('shouldRefreshScores', () => {
	const lastKickoff = new Date('2024-09-07T23:30:00Z');
	const hardCapStart = new Date('2024-09-07T23:30:00Z');

	it('returns true in a valid refresh window', () => {
		const now = new Date(lastKickoff.getTime() + 3 * 60 * 60 * 1000); // 3hr after last kickoff
		const lastRefreshAt = new Date(now.getTime() - 90 * 60 * 1000); // refreshed 90min ago
		expect(shouldRefreshScores({ now, lastKickoff, lastRefreshAt, hardCapStart })).toBe(true);
	});

	it('returns false when refresh happened less than 60min ago (throttle)', () => {
		const now = new Date(lastKickoff.getTime() + 2 * 60 * 60 * 1000);
		const lastRefreshAt = new Date(now.getTime() - 30 * 60 * 1000);
		expect(shouldRefreshScores({ now, lastKickoff, lastRefreshAt, hardCapStart })).toBe(false);
	});

	it('returns false when now < lastKickoff (games not started)', () => {
		const now = new Date(lastKickoff.getTime() - 60 * 1000);
		expect(shouldRefreshScores({ now, lastKickoff, lastRefreshAt: null, hardCapStart })).toBe(false);
	});

	it('returns false when past 12hr hard cap', () => {
		const now = new Date(hardCapStart.getTime() + 13 * 60 * 60 * 1000);
		expect(shouldRefreshScores({ now, lastKickoff, lastRefreshAt: null, hardCapStart })).toBe(false);
	});

	it('returns false when lastKickoff is null', () => {
		const now = new Date();
		expect(shouldRefreshScores({ now, lastKickoff: null, lastRefreshAt: null, hardCapStart: null })).toBe(false);
	});

	it('returns true when lastRefreshAt is null', () => {
		const now = new Date(lastKickoff.getTime() + 2 * 60 * 60 * 1000);
		expect(shouldRefreshScores({ now, lastKickoff, lastRefreshAt: null, hardCapStart })).toBe(true);
	});
});

describe('isWeekComplete', () => {
	it('returns true when all games are completed', () => {
		const games = [makeGame({ completed: true }), makeGame({ gameId: 2, completed: true })];
		expect(isWeekComplete(games)).toBe(true);
	});

	it('returns false when at least one game is not completed', () => {
		const games = [makeGame({ completed: true }), makeGame({ gameId: 2, completed: false })];
		expect(isWeekComplete(games)).toBe(false);
	});

	it('returns false for empty array', () => {
		expect(isWeekComplete([])).toBe(false);
	});
});

describe('getFirstKickoff', () => {
	it('returns the earliest startTime', () => {
		const t1 = new Date('2024-09-07T12:00:00Z');
		const t2 = new Date('2024-09-07T20:00:00Z');
		const games = [makeGame({ startTime: t2 }), makeGame({ gameId: 2, startTime: t1 })];
		expect(getFirstKickoff(games)).toEqual(t1);
	});

	it('returns null when all startTimes are null', () => {
		expect(getFirstKickoff([makeGame()])).toBeNull();
	});

	it('returns null for empty array', () => {
		expect(getFirstKickoff([])).toBeNull();
	});
});

describe('getLastKickoff', () => {
	it('returns the latest startTime', () => {
		const t1 = new Date('2024-09-07T12:00:00Z');
		const t2 = new Date('2024-09-07T20:00:00Z');
		const games = [makeGame({ startTime: t1 }), makeGame({ gameId: 2, startTime: t2 })];
		expect(getLastKickoff(games)).toEqual(t2);
	});

	it('returns null when all startTimes are null', () => {
		expect(getLastKickoff([makeGame()])).toBeNull();
	});

	it('returns null for empty array', () => {
		expect(getLastKickoff([])).toBeNull();
	});
});
