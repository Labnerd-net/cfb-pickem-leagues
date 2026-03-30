import { useState, useEffect, useMemo } from 'react';
import type { AdminGameWire } from '../../apis/userRequests';
import { getNow } from '../../utils/clock';

const TWO_MINUTES_MS = 2 * 60 * 1000;
const SLOW_INTERVAL_MS = 5000;
const FAST_INTERVAL_MS = 1000;

/**
 * Returns a `now` Date that ticks at an adaptive interval:
 * - Every 5 seconds when the earliest unlocked game is > 2 minutes away
 * - Every 1 second when within 2 minutes (drives the "X m Y s" display)
 *
 * The interval re-registers automatically when the game crosses the 2-minute
 * boundary because `intervalMs` is derived from `now` via useMemo.
 *
 * When VITE_IGNORE_PICK_DEADLINE is true, no interval is registered and
 * a static Date is returned (countdown and warning dialog are not shown).
 */
export function useCountdownTick(games: AdminGameWire[]): Date {
  const ignoreDeadline = import.meta.env.VITE_IGNORE_PICK_DEADLINE === 'true';
  const [now, setNow] = useState<Date>(() => getNow());

  // Recomputed on every tick so the interval tightens when a game enters the 2-minute window.
  const intervalMs = useMemo(() => {
    if (ignoreDeadline) return null;
    const earliestUnlockedMs = games.reduce<number>((min, g) => {
      if (!g.startTime) return min;
      const ms = new Date(g.startTime).getTime() - now.getTime();
      return ms > 0 ? Math.min(min, ms) : min;
    }, Infinity);
    if (!isFinite(earliestUnlockedMs)) return null;
    return earliestUnlockedMs <= TWO_MINUTES_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
  }, [ignoreDeadline, games, now]);

  useEffect(() => {
    if (intervalMs === null) return;
    const id = setInterval(() => setNow(getNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
