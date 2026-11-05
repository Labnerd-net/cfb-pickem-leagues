// On Cloudflare Workers, `wrangler deploy` inlines `process.env.NODE_ENV` as the literal
// "production" at bundle time, so a direct runtime read of it can never see the real
// environment (see the note in db/index.ts). worker.ts passes the Worker `env` binding to
// syncClockEnv() on every invocation; those values take precedence over process.env.
// If the binding has no NODE_ENV, we fall back to the process.env read — which on a Worker
// is the inlined "production" — so a missing value fails safe to the real clock.
let workerEnv: { NODE_ENV?: string; DEV_CURRENT_TIME?: string } = {};

export function syncClockEnv(env: Record<string, unknown>): void {
  workerEnv = {
    NODE_ENV: typeof env.NODE_ENV === 'string' ? env.NODE_ENV : undefined,
    DEV_CURRENT_TIME: typeof env.DEV_CURRENT_TIME === 'string' ? env.DEV_CURRENT_TIME : undefined,
  };
}

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
  const nodeEnv = workerEnv.NODE_ENV ?? process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    return new Date();
  }
  const devTime = workerEnv.DEV_CURRENT_TIME ?? process.env.DEV_CURRENT_TIME;
  if (devTime) {
    const parsed = new Date(devTime);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
