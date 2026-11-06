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
function readLocalOverride(): string | null {
  try {
    return localStorage.getItem('devCurrentTime');
  } catch {
    return null; // storage blocked (e.g. Safari "Block All Cookies") — fall back to real time
  }
}

export function getNow(): Date {
  const localTime = readLocalOverride();
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
  const local = readLocalOverride();
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
