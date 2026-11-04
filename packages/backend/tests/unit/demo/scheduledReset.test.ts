import { describe, it, expect, vi, beforeEach } from 'vitest';

const { resetMock } = vi.hoisted(() => ({ resetMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../src/demo/resetDemo.js', () => ({ resetDemo: resetMock }));
vi.mock('../../../src/demo/seedData.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../src/demo/seedData.js')>()),
  buildDemoSeed: vi.fn().mockReturnValue({}),
}));

import { chicagoHour, isResetHour, runScheduledDemoReset } from '../../../src/demo/scheduledReset.js';

describe('chicagoHour / isResetHour', () => {
  it('maps UTC to Chicago local hour in summer (CDT, UTC-5) and winter (CST, UTC-6)', () => {
    expect(chicagoHour(new Date('2024-07-15T05:00:00Z'))).toBe(0);
    expect(chicagoHour(new Date('2024-07-15T06:00:00Z'))).toBe(1);
    expect(chicagoHour(new Date('2024-01-15T06:00:00Z'))).toBe(0);
    expect(chicagoHour(new Date('2024-01-15T05:00:00Z'))).toBe(23);
  });

  it('handles both daylight saving transitions', () => {
    // Spring forward: 2024-03-10 08:00Z. Night before is CST, night after is CDT.
    expect(isResetHour(new Date('2024-03-10T06:00:00Z'))).toBe(true);
    expect(isResetHour(new Date('2024-03-10T05:00:00Z'))).toBe(false);
    expect(isResetHour(new Date('2024-03-11T05:00:00Z'))).toBe(true);
    expect(isResetHour(new Date('2024-03-11T06:00:00Z'))).toBe(false);
    // Fall back: 2024-11-03 07:00Z.
    expect(isResetHour(new Date('2024-11-03T05:00:00Z'))).toBe(true);
    expect(isResetHour(new Date('2024-11-03T06:00:00Z'))).toBe(false);
    expect(isResetHour(new Date('2024-11-04T06:00:00Z'))).toBe(true);
    expect(isResetHour(new Date('2024-11-04T05:00:00Z'))).toBe(false);
  });

  it('exactly one of the 05:00 and 06:00 UTC triggers is Chicago midnight, every day of the year', () => {
    for (let d = 0; d < 366; d++) {
      const day = Date.UTC(2024, 0, 1 + d);
      const at5 = isResetHour(new Date(day + 5 * 3_600_000));
      const at6 = isResetHour(new Date(day + 6 * 3_600_000));
      expect(Number(at5) + Number(at6)).toBe(1);
    }
  });
});

describe('runScheduledDemoReset', () => {
  beforeEach(() => resetMock.mockClear());

  it('resets only on the trigger that lands in Chicago hour 0', async () => {
    await runScheduledDemoReset(Date.parse('2024-07-15T06:00:00Z')); // 1 AM CDT
    expect(resetMock).not.toHaveBeenCalled();
    await runScheduledDemoReset(Date.parse('2024-07-15T05:00:00Z')); // midnight CDT
    expect(resetMock).toHaveBeenCalledTimes(1);
  });
});
