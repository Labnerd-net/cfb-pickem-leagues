import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getNow } from '../../../src/utils/clock.js';

describe('getNow()', () => {
  let origNodeEnv: string | undefined;
  let origDevTime: string | undefined;

  beforeEach(() => {
    origNodeEnv = process.env.NODE_ENV;
    origDevTime = process.env.DEV_CURRENT_TIME;
  });

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    if (origDevTime === undefined) {
      delete process.env.DEV_CURRENT_TIME;
    } else {
      process.env.DEV_CURRENT_TIME = origDevTime;
    }
  });

  it('returns DEV_CURRENT_TIME when set and NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_CURRENT_TIME = '2024-08-31T10:00:00Z';
    const result = getNow();
    expect(result.toISOString()).toBe('2024-08-31T10:00:00.000Z');
  });

  it('returns DEV_CURRENT_TIME in test environment (NODE_ENV=test)', () => {
    // setup.ts sets NODE_ENV=test, which is also non-production
    process.env.DEV_CURRENT_TIME = '2024-09-14T15:00:00Z';
    const result = getNow();
    expect(result.toISOString()).toBe('2024-09-14T15:00:00.000Z');
  });

  it('returns current time when DEV_CURRENT_TIME is not set', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEV_CURRENT_TIME;
    const before = Date.now();
    const result = getNow();
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it('ignores DEV_CURRENT_TIME and returns real time when NODE_ENV is production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_CURRENT_TIME = '2024-08-31T10:00:00Z';
    const before = Date.now();
    const result = getNow();
    const after = Date.now();
    // Should not return the pinned dev time
    expect(result.toISOString()).not.toBe('2024-08-31T10:00:00.000Z');
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it('falls back to current time when DEV_CURRENT_TIME is unparseable', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_CURRENT_TIME = 'not-a-date';
    const before = Date.now();
    const result = getNow();
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});
