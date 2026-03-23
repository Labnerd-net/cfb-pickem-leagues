import type { AdminDbGameData } from '@shared/types/cfb-pickem-api.js';

// Returns true if now is in [firstKickoff - 75min, firstKickoff - 60min]
export function shouldSendPicksReminder({
  now,
  firstKickoff,
}: {
  now: Date;
  firstKickoff: Date | null;
}): boolean {
  if (!firstKickoff) return false;
  const windowStart = new Date(firstKickoff.getTime() - 75 * 60 * 1000);
  const windowEnd = new Date(firstKickoff.getTime() - 60 * 60 * 1000);
  return now >= windowStart && now <= windowEnd;
}

// Returns true if now is in [firstKickoff - 25h, firstKickoff - 24h]
export function shouldSend24hrReminder({
  now,
  firstKickoff,
}: {
  now: Date;
  firstKickoff: Date | null;
}): boolean {
  if (!firstKickoff) return false;
  const windowStart = new Date(firstKickoff.getTime() - 25 * 60 * 60 * 1000);
  const windowEnd = new Date(firstKickoff.getTime() - 24 * 60 * 60 * 1000);
  return now >= windowStart && now <= windowEnd;
}

// Returns true if we should refresh scores
export function shouldRefreshScores({
  now,
  lastKickoff,
  lastRefreshAt,
  hardCapStart,
}: {
  now: Date;
  lastKickoff: Date | null;
  lastRefreshAt: Date | null;
  hardCapStart: Date | null;
}): boolean {
  if (!lastKickoff) return false;
  if (now < lastKickoff) return false;
  if (lastRefreshAt && now.getTime() - lastRefreshAt.getTime() < 60 * 60 * 1000) return false;
  if (hardCapStart && now.getTime() - hardCapStart.getTime() >= 12 * 60 * 60 * 1000) return false;
  return true;
}

// Returns true if all games in the array are completed (and array is non-empty)
export function isWeekComplete(games: AdminDbGameData[]): boolean {
  return games.length > 0 && games.every(g => g.completed);
}

// Returns the earliest startTime, or null if none
export function getFirstKickoff(games: AdminDbGameData[]): Date | null {
  const times = games.map(g => g.startTime).filter((t): t is Date => t !== null);
  if (times.length === 0) return null;
  return new Date(Math.min(...times.map(t => t.getTime())));
}

// Returns the latest startTime, or null if none
export function getLastKickoff(games: AdminDbGameData[]): Date | null {
  const times = games.map(g => g.startTime).filter((t): t is Date => t !== null);
  if (times.length === 0) return null;
  return new Date(Math.max(...times.map(t => t.getTime())));
}
