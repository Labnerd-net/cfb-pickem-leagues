import { describe, it, expect } from 'vitest';
import { getResetStatus, formatTimeUntil } from '../../../src/utils/nextReset.js';

const iso = (d: Date) => d.toISOString();

describe('getResetStatus — next reset is Chicago midnight', () => {
	it('summer (CDT, UTC-5): next reset is 05:00 UTC', () => {
		const { next } = getResetStatus(new Date('2024-07-15T12:00:00Z'));
		expect(iso(next)).toBe('2024-07-16T05:00:00.000Z');
	});

	it('winter (CST, UTC-6): next reset is 06:00 UTC', () => {
		const { next } = getResetStatus(new Date('2024-01-15T12:00:00Z'));
		expect(iso(next)).toBe('2024-01-16T06:00:00.000Z');
	});

	it('just before the reset it is still the same reset', () => {
		const { next } = getResetStatus(new Date('2024-07-16T04:59:59Z'));
		expect(iso(next)).toBe('2024-07-16T05:00:00.000Z');
	});

	it('at the reset instant the next one is a day later', () => {
		const { next } = getResetStatus(new Date('2024-07-16T05:00:00Z'));
		expect(iso(next)).toBe('2024-07-17T05:00:00.000Z');
	});

	it('spring forward (2024-03-10): the night before is CST, the night after is CDT', () => {
		expect(iso(getResetStatus(new Date('2024-03-09T20:00:00Z')).next)).toBe('2024-03-10T06:00:00.000Z');
		expect(iso(getResetStatus(new Date('2024-03-10T12:00:00Z')).next)).toBe('2024-03-11T05:00:00.000Z');
	});

	it('fall back (2024-11-03): the night before is CDT, the night after is CST', () => {
		expect(iso(getResetStatus(new Date('2024-11-02T20:00:00Z')).next)).toBe('2024-11-03T05:00:00.000Z');
		expect(iso(getResetStatus(new Date('2024-11-03T12:00:00Z')).next)).toBe('2024-11-04T06:00:00.000Z');
	});

	it('always returns a future reset at most 25 hours away, every day of the year', () => {
		for (let d = 0; d < 366; d++) {
			for (const hour of [0, 5, 6, 12, 23]) {
				const now = new Date(Date.UTC(2024, 0, 1 + d, hour, 30));
				const { next } = getResetStatus(now);
				const diff = next.getTime() - now.getTime();
				expect(diff).toBeGreaterThan(0);
				expect(diff).toBeLessThanOrEqual(25 * 3_600_000);
			}
		}
	});
});

describe('getResetStatus — resetting window', () => {
	it('is resetting for a minute after the reset fires', () => {
		expect(getResetStatus(new Date('2024-07-16T05:00:00Z')).resetting).toBe(true);
		expect(getResetStatus(new Date('2024-07-16T05:00:59Z')).resetting).toBe(true);
	});

	it('is not resetting before the reset or once the minute has passed', () => {
		expect(getResetStatus(new Date('2024-07-16T04:59:59Z')).resetting).toBe(false);
		expect(getResetStatus(new Date('2024-07-16T05:01:00Z')).resetting).toBe(false);
		expect(getResetStatus(new Date('2024-07-16T17:00:00Z')).resetting).toBe(false);
	});

	it('uses the CST reset time in winter', () => {
		expect(getResetStatus(new Date('2024-01-16T06:00:30Z')).resetting).toBe(true);
		expect(getResetStatus(new Date('2024-01-16T05:00:30Z')).resetting).toBe(false);
	});
});

describe('formatTimeUntil', () => {
	it('formats hours, minutes, and seconds', () => {
		expect(formatTimeUntil(0)).toBe('0h 00m 00s');
		expect(formatTimeUntil(5 * 3_600_000 + 12 * 60_000 + 3_000)).toBe('5h 12m 03s');
		expect(formatTimeUntil(24 * 3_600_000)).toBe('24h 00m 00s');
	});

	it('never goes negative', () => {
		expect(formatTimeUntil(-5000)).toBe('0h 00m 00s');
	});
});
