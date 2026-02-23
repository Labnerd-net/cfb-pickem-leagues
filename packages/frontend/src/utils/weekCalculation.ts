import type { AdminDbWeekData } from '@shared/types/cfb-pickem-api.js';

export interface CurrentWeek {
  year: number;
  week: number;
}

export function getMostRecentCompletedWeek(weeks: AdminDbWeekData[]): CurrentWeek {
  const now = new Date();
  const completed = weeks
    .filter(w => new Date(w.weekEnd) < now)
    .sort((a, b) => b.year - a.year || b.weekNumber - a.weekNumber);
  if (completed.length > 0)
    return { year: completed[0].year, week: completed[0].weekNumber };
  // No completed weeks yet — fall back to first available
  const sorted = [...weeks].sort((a, b) => a.year - b.year || a.weekNumber - b.weekNumber);
  return sorted.length > 0
    ? { year: sorted[0].year, week: sorted[0].weekNumber }
    : { year: now.getFullYear(), week: 1 };
}

export function getCurrentWeek(weeks: AdminDbWeekData[]): CurrentWeek {
  const now = new Date();

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
  const latestYear = sortedByYear[0]?.year || now.getFullYear();
  const nextSeasonWeek1 = weeks.find(w => w.year === latestYear && w.weekNumber === 1);

  if (nextSeasonWeek1) {
    return { year: nextSeasonWeek1.year, week: nextSeasonWeek1.weekNumber };
  }

  // Fallback: use current year, week 1
  return { year: now.getFullYear(), week: 1 };
}
