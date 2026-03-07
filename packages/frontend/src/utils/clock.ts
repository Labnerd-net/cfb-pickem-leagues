/**
 * Returns the current time for deadline checks.
 *
 * Priority order:
 * 1. localStorage 'devCurrentTime' — set by the Dev Tools tab at runtime
 * 2. VITE_DEV_CURRENT_TIME build-time env var
 * 3. Real system clock
 *
 * In production builds, neither override will normally be present and this
 * returns new Date() as normal.
 */
export function getNow(): Date {
  const localTime = localStorage.getItem('devCurrentTime');
  if (localTime) {
    const parsed = new Date(localTime);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const devTime = import.meta.env.VITE_DEV_CURRENT_TIME;
  if (devTime) {
    const parsed = new Date(devTime as string);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/** ISO string that clock.ts will use, or null if running on real time. */
export function getActiveSimTime(): string | null {
  const local = localStorage.getItem('devCurrentTime');
  if (local) {
    const d = new Date(local);
    if (!isNaN(d.getTime())) return local;
  }
  const env = import.meta.env.VITE_DEV_CURRENT_TIME as string | undefined;
  if (env) {
    const d = new Date(env);
    if (!isNaN(d.getTime())) return env;
  }
  return null;
}
