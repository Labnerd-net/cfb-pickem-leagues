// The demo database resets every night at midnight America/Chicago (see the backend's
// scheduledReset.ts). These helpers work out when, so the banner can count down to it.
// They always take the REAL current time, never the demo's pinned clock.

const CHICAGO_TZ = 'America/Chicago';
const RESETTING_WINDOW_MS = 60_000;

const chicagoFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: CHICAGO_TZ,
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

function isChicagoMidnight(date: Date): boolean {
  const parts = chicagoFormat.formatToParts(date);
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  const minute = Number(parts.find(p => p.type === 'minute')?.value);
  return hour === 0 && minute === 0;
}

// Chicago midnight is 05:00 UTC (CDT) or 06:00 UTC (CST). Check both on the days around `now`
// and keep whichever is actually midnight in Chicago. Exactly one is, every day of the year.
function resetInstantsAround(now: Date): Date[] {
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const instants: Date[] = [];
  for (let day = -1; day <= 2; day++) {
    for (const hour of [5, 6]) {
      const candidate = new Date(base + day * 86_400_000 + hour * 3_600_000);
      if (isChicagoMidnight(candidate)) instants.push(candidate);
    }
  }
  return instants;
}

export interface ResetStatus {
  /** The next reset strictly after `now`. */
  next: Date;
  /** True for a minute after a reset fires, while the database is being reseeded. */
  resetting: boolean;
}

export function getResetStatus(now: Date): ResetStatus {
  const instants = resetInstantsAround(now);
  const next = instants.find(i => i.getTime() > now.getTime())!;
  const previous = [...instants].reverse().find(i => i.getTime() <= now.getTime());
  const resetting = previous !== undefined && now.getTime() - previous.getTime() < RESETTING_WINDOW_MS;
  return { next, resetting };
}

/** "5h 12m 03s" — hours are not capped at 24 so the DST-length days read correctly. */
export function formatTimeUntil(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}
