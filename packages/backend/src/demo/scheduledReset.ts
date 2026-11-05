import logger from '../utils/logger.js';
import { resetDemo } from './resetDemo.js';
import { buildDemoSeed } from './seedData.js';
import { demoGameData } from './demoGameData.js';

const RESET_TIME_ZONE = 'America/Chicago';

/** Hour of day (0-23) in America/Chicago for the given instant. */
export function chicagoHour(date: Date): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: RESET_TIME_ZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(date);
  return Number(hour);
}

/**
 * Cloudflare cron triggers are UTC-only. The demo Worker is triggered at both 05:00 and
 * 06:00 UTC; midnight in Chicago is one of those two depending on daylight saving time, so
 * the reset runs only on the trigger that lands in Chicago hour 0. That gives exactly one
 * reset per night with no stored marker.
 */
export function isResetHour(scheduledTime: Date): boolean {
  return chicagoHour(scheduledTime) === 0;
}

export async function runScheduledDemoReset(scheduledTimeMs: number): Promise<void> {
  const scheduled = new Date(scheduledTimeMs);
  if (!isResetHour(scheduled)) {
    logger.info({ scheduled: scheduled.toISOString() }, 'demo reset skipped: not Chicago midnight');
    return;
  }
  await resetDemo(buildDemoSeed(demoGameData));
  logger.info({ scheduled: scheduled.toISOString() }, 'demo reset complete');
}
