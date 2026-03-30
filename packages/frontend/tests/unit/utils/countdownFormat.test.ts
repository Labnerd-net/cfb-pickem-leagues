import { describe, it, expect } from 'vitest';
import {
  formatCountdown,
  isRedThreshold,
  isWarningThreshold,
  LOCK_WARNING_THRESHOLD_MS,
} from '../../../src/utils/countdownFormat';

describe('formatCountdown', () => {
  it('formats hours and minutes when >= 60 minutes', () => {
    expect(formatCountdown(3 * 3600000 + 22 * 60000)).toBe('Locks in 3 h 22 m');
  });

  it('formats exactly 1 hour', () => {
    expect(formatCountdown(3600000)).toBe('Locks in 1 h 0 m');
  });

  it('omits hours when 0 h (59 minutes)', () => {
    expect(formatCountdown(45 * 60000)).toBe('Locks in 45 m');
  });

  it('formats minutes only when >= 2 minutes', () => {
    expect(formatCountdown(5 * 60000)).toBe('Locks in 5 m');
  });

  it('formats minutes and seconds when between 1 and 2 minutes', () => {
    expect(formatCountdown(90000)).toBe('Locks in 1 m 30 s');
  });

  it('formats seconds only when under 1 minute', () => {
    expect(formatCountdown(45000)).toBe('Locks in 45 s');
  });

  it('returns empty string for 0', () => {
    expect(formatCountdown(0)).toBe('');
  });

  it('returns empty string for negative values', () => {
    expect(formatCountdown(-1000)).toBe('');
  });
});

describe('isRedThreshold', () => {
  it('returns true at 59 minutes 59 seconds', () => {
    expect(isRedThreshold(3599000)).toBe(true);
  });

  it('returns false at exactly 60 minutes', () => {
    expect(isRedThreshold(3600000)).toBe(false);
  });

  it('returns false for 0', () => {
    expect(isRedThreshold(0)).toBe(false);
  });

  it('returns false for negative values', () => {
    expect(isRedThreshold(-1)).toBe(false);
  });
});

describe('isWarningThreshold', () => {
  it('returns true at 14 minutes', () => {
    expect(isWarningThreshold(14 * 60000)).toBe(true);
  });

  it('returns true at exactly the threshold boundary (15 minutes)', () => {
    expect(isWarningThreshold(LOCK_WARNING_THRESHOLD_MS)).toBe(true);
  });

  it('returns false above the threshold (16 minutes)', () => {
    expect(isWarningThreshold(16 * 60000)).toBe(false);
  });

  it('returns false for 0', () => {
    expect(isWarningThreshold(0)).toBe(false);
  });

  it('returns false for negative values', () => {
    expect(isWarningThreshold(-1)).toBe(false);
  });
});
