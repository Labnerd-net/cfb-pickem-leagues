import type { AdminDbWeekData, AdminDbGameData } from '@shared/types/cfb-pickem-api.js';
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

export function getMostRecentCompletedWeek(weeks: AdminDbWeekData[]): CurrentWeek {
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

export function isResultsMode(games: AdminDbGameData[]): boolean {
  return games.some(
    g => g.completed || (g.startTime !== null && getNow() >= new Date(g.startTime)),
  );
}

export function getCurrentWeek(weeks: AdminDbWeekData[]): CurrentWeek {
  const now = getNow();

  // Find week where current date is between weekStart and weekEnd
  const currentWeek = weeks.find(week => {
    const start = new Date(week.weekStart);
    const end = new Date(week.weekEnd);
    return now >= start && now <= end;
  });

  if (currentWeek) {
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
