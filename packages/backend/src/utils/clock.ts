/**
 * Returns the current time.
 *
 * In production, always returns the real system clock.
 * In non-production environments, DEV_CURRENT_TIME can override the clock
 * to allow simulating pick deadlines, cron logic, and score refresh without
 * waiting for real dates.
 *
 * Usage: set DEV_CURRENT_TIME=2024-08-31T10:00:00Z in your dev environment.
 */
export function getNow(): Date {
  if (process.env.NODE_ENV === 'production') {
    return new Date();
  }
  const devTime = process.env.DEV_CURRENT_TIME;
  if (devTime) {
    const parsed = new Date(devTime);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
