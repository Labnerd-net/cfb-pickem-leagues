import type { AdminWeekData } from '@shared/types/cfb-pickem-api.js';
import { getNow } from './clock.js';

export { getNow };

export interface CurrentWeek {
  year: number;
  week: number;
}

// VITE_SEASON_ROLLOVER_MONTH: 1-based month (e.g. 3 = March). Converted to 0-based for JS Date.
const SEASON_ROLLOVER_MONTH = (Number(import.meta.env.VITE_SEASON_ROLLOVER_MONTH) || 3) - 1;

/**
 * Returns the current CFB season year. Before the rollover month, returns the prior calendar
 * year so that January–February still show the previous season (e.g. bowl games / natty).
 */
export function getCurrentSeason(date: Date = getNow()): number {
  return date.getMonth() < SEASON_ROLLOVER_MONTH
    ? date.getFullYear() - 1
    : date.getFullYear();
}

export function getMostRecentCompletedWeek(weeks: AdminWeekData[]): CurrentWeek {
  const now = getNow();
  const completed = weeks
    .filter(w => new Date(w.weekEnd) < now)
    .sort((a, b) => b.year - a.year || b.weekNumber - a.weekNumber);
  if (completed.length > 0)
    return { year: completed[0].year, week: completed[0].weekNumber };
  // No completed weeks yet — fall back to first available
  const sorted = [...weeks].sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);
  return sorted.length > 0
    ? { year: sorted[0].year, week: sorted[0].weekNumber }
    : { year: getCurrentSeason(now), week: 1 };
}

/**
 * Whether a single game should render as a read-only result (kicked off or completed)
 * rather than an editable pick. Evaluated per-game — a week is a mix of both once its
 * games start spreading across multiple days/weekends, so no week-wide toggle exists.
 */
export function isGameInResultsMode(game: { completed: boolean; startTime: Date | string | null }): boolean {
  return game.completed || (game.startTime !== null && getNow() >= new Date(game.startTime as string));
}

/**
 * Local-midnight date the dashboard should switch to this week. The CFBD calendar starts most
 * weeks on Monday, which would hide the prior weekend's results on Monday morning — so weeks
 * starting Monday or Tuesday roll over on the following Wednesday instead. Weeks that start
 * Wednesday–Sunday (week 1, postseason) roll over on their start date.
 */
function getRolloverDate(week: AdminWeekData): Date {
  const [y, m, d] = week.weekStart.slice(0, 10).split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const day = start.getDay(); // 0 = Sunday
  if (day === 1 || day === 2) start.setDate(start.getDate() + (3 - day));
  return start;
}

const ROLLOVER_GRACE_DAYS = 2;

function getEndOfWeekEnd(week: AdminWeekData): Date {
  const [y, m, d] = week.weekEnd.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export function getCurrentWeek(weeks: AdminWeekData[]): CurrentWeek {
  const now = getNow();

  // Latest week whose rollover date has passed. It stays current until the next week rolls
  // over, so the Mon/Tue gap between a week's end and the next Wednesday keeps the prior week.
  const sorted = [...weeks].sort(
    (a, b) => getRolloverDate(a).getTime() - getRolloverDate(b).getTime()
      || a.year - b.year || a.weekNumber - b.weekNumber
  );
  let idx = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (getRolloverDate(sorted[i]) <= now) idx = i;
  }
  const currentWeek = idx >= 0 ? sorted[idx] : undefined;

  // Grace covers the gap between a Monday weekEnd and the next Wednesday rollover. Beyond
  // that, the week is stale (season over) and we fall through to the off-season default.
  const graceEnd = currentWeek ? getEndOfWeekEnd(currentWeek) : null;
  graceEnd?.setDate(graceEnd.getDate() + ROLLOVER_GRACE_DAYS);

  if (currentWeek && graceEnd && now <= graceEnd) {
    return { year: currentWeek.year, week: currentWeek.weekNumber };
  }

  // Off-season: Default to first week of next season
  // Sort by year descending, then find week 1
  const sortedByYear = [...weeks].sort((a, b) => b.year - a.year);
  const latestYear = sortedByYear[0]?.year || getCurrentSeason(now);
  const nextSeasonWeek1 = weeks.find(w => w.year === latestYear && w.weekNumber === 1);

  if (nextSeasonWeek1) {
    return { year: nextSeasonWeek1.year, week: nextSeasonWeek1.weekNumber };
  }

  // Fallback: use current season year, week 1
  return { year: getCurrentSeason(now), week: 1 };
}
