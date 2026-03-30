export const LOCK_WARNING_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Formats milliseconds remaining into a human-readable countdown string.
 * Returns "" when msRemaining <= 0 (caller should show LOCKED state instead).
 */
export function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '';

  const totalSeconds = Math.floor(msRemaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds >= 3600) {
    return `Locks in ${hours} h ${minutes} m`;
  }
  if (totalSeconds >= 120) {
    return `Locks in ${minutes} m`;
  }
  if (totalSeconds >= 60) {
    return `Locks in ${minutes} m ${seconds} s`;
  }
  return `Locks in ${seconds} s`;
}

/** True when the game is within the warning dialog threshold but not yet locked. */
export function isWarningThreshold(msRemaining: number): boolean {
  return msRemaining > 0 && msRemaining <= LOCK_WARNING_THRESHOLD_MS;
}

/**
 * True when the game is within 1 hour of locking (triggers red styling).
 * Strict `<` is intentional: at exactly 3,600,000 ms the card shows "Locks in 1 h 0 m"
 * in neutral colour, consistent with "under 1 hour" in the spec.
 */
export function isRedThreshold(msRemaining: number): boolean {
  return msRemaining > 0 && msRemaining < 60 * 60 * 1000;
}
