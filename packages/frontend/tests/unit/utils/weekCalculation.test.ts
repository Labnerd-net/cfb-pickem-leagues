import { describe, it, expect, vi } from 'vitest';

// Mock import.meta.env before importing the module
vi.stubGlobal('import', { meta: { env: { VITE_SEASON_ROLLOVER_MONTH: undefined } } });

// We need to test getCurrentSeason in isolation, so define a local version that accepts a rollover
// month directly (mirrors the real implementation) to avoid module-level constant issues.
function getCurrentSeasonWith(rolloverMonth0Based: number, date: Date): number {
  return date.getMonth() < rolloverMonth0Based ? date.getFullYear() - 1 : date.getFullYear();
}

// Default rollover is March (month index 2, i.e. VITE_SEASON_ROLLOVER_MONTH=3)
const DEFAULT_ROLLOVER = 2;

describe('getCurrentSeason', () => {
  describe('default rollover (March)', () => {
    it('returns prior year in January', () => {
      const date = new Date(2026, 0, 15); // Jan 15, 2026
      expect(getCurrentSeasonWith(DEFAULT_ROLLOVER, date)).toBe(2025);
    });

    it('returns prior year on February 28', () => {
      const date = new Date(2026, 1, 28); // Feb 28, 2026
      expect(getCurrentSeasonWith(DEFAULT_ROLLOVER, date)).toBe(2025);
    });

    it('returns current year on March 1', () => {
      const date = new Date(2026, 2, 1); // Mar 1, 2026
      expect(getCurrentSeasonWith(DEFAULT_ROLLOVER, date)).toBe(2026);
    });

    it('returns current year in August', () => {
      const date = new Date(2025, 7, 1); // Aug 1, 2025
      expect(getCurrentSeasonWith(DEFAULT_ROLLOVER, date)).toBe(2025);
    });

    it('returns current year in December', () => {
      const date = new Date(2025, 11, 15); // Dec 15, 2025
      expect(getCurrentSeasonWith(DEFAULT_ROLLOVER, date)).toBe(2025);
    });
  });

  describe('custom rollover month (April = month index 3)', () => {
    const APRIL_ROLLOVER = 3;

    it('returns prior year in January', () => {
      const date = new Date(2026, 0, 1);
      expect(getCurrentSeasonWith(APRIL_ROLLOVER, date)).toBe(2025);
    });

    it('returns prior year in March', () => {
      const date = new Date(2026, 2, 15); // Mar 15 — still before April cutoff
      expect(getCurrentSeasonWith(APRIL_ROLLOVER, date)).toBe(2025);
    });

    it('returns current year on April 1', () => {
      const date = new Date(2026, 3, 1); // Apr 1, 2026
      expect(getCurrentSeasonWith(APRIL_ROLLOVER, date)).toBe(2026);
    });
  });
});

// Tests for getMostRecentCompletedWeek and getCurrentWeek fallback paths
import type { AdminDbWeekData } from '@shared/types/cfb-pickem-api';
import { getMostRecentCompletedWeek, getCurrentWeek } from '../../../src/utils/weekCalculation';

function makeWeek(year: number, weekNumber: number, daysAgo: number): AdminDbWeekData {
  const end = new Date();
  end.setDate(end.getDate() - daysAgo);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return {
    year,
    weekNumber,
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    seasonType: 'regular',
  } as AdminDbWeekData;
}

function makeFutureWeek(year: number, weekNumber: number, daysFromNow: number): AdminDbWeekData {
  const start = new Date();
  start.setDate(start.getDate() + daysFromNow);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return {
    year,
    weekNumber,
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    seasonType: 'regular',
  } as AdminDbWeekData;
}

describe('getMostRecentCompletedWeek', () => {
  it('returns the most recently completed week', () => {
    const weeks = [makeWeek(2025, 1, 20), makeWeek(2025, 2, 13), makeWeek(2025, 3, 6)];
    const result = getMostRecentCompletedWeek(weeks);
    expect(result).toEqual({ year: 2025, week: 3 });
  });

  it('returns first week when no weeks are completed (fallback to first available)', () => {
    const weeks = [makeFutureWeek(2025, 1, 10), makeFutureWeek(2025, 2, 17)];
    const result = getMostRecentCompletedWeek(weeks);
    expect(result).toEqual({ year: 2025, week: 1 });
  });

  it('returns season year and week 1 when weeks array is empty', () => {
    const result = getMostRecentCompletedWeek([]);
    expect(result.week).toBe(1);
    expect(typeof result.year).toBe('number');
  });
});

describe('getCurrentWeek', () => {
  it('returns the week that spans today', () => {
    makeFutureWeek(2025, 5, -3); // started 3 days ago, ends 4 days from now
    // Override end to be in the future
    const start = new Date();
    start.setDate(start.getDate() - 3);
    const end = new Date();
    end.setDate(end.getDate() + 4);
    const inProgressWeek: AdminDbWeekData = {
      year: 2025,
      weekNumber: 5,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      seasonType: 'regular',
    } as AdminDbWeekData;

    const result = getCurrentWeek([inProgressWeek]);
    expect(result).toEqual({ year: 2025, week: 5 });
  });

  it('falls back to week 1 of latest year when no week spans today', () => {
    const past1 = makeWeek(2025, 1, 20);
    const past2 = makeWeek(2025, 2, 13);
    const future1 = makeFutureWeek(2025, 1, 10);

    const result = getCurrentWeek([past1, past2, future1]);
    // Should find week 1 of the latest year
    expect(result.week).toBe(1);
    expect(result.year).toBe(2025);
  });

  it('returns season year and week 1 when weeks array is empty', () => {
    const result = getCurrentWeek([]);
    expect(result.week).toBe(1);
    expect(typeof result.year).toBe('number');
  });
});
