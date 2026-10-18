import type { LeaderboardEntry } from '@shared/types/cfb-pickem-api.js';

// A user must have finished picks >= this fraction of the league's highest finished-pick
// count to be ranked by percentage. Prevents e.g. a 1-0 user from topping the board.
export const MIN_PARTICIPATION_RATIO = 0.5;

type UnrankedEntry = Omit<LeaderboardEntry, 'rank' | 'qualified'>;

// Qualified users first (percentage DESC, correct DESC, name), then unqualified in the same
// order with rank null. Users with identical correct and total share a rank (1, 1, 3).
export function rankLeaderboard(entries: UnrankedEntry[]): LeaderboardEntry[] {
  const maxTotal = Math.max(0, ...entries.map(e => e.total));
  const minTotal = maxTotal * MIN_PARTICIPATION_RATIO;

  const withFlag = entries.map(e => ({ ...e, qualified: e.total > 0 && e.total >= minTotal }));

  // IEEE division is correctly rounded, so equal ratios (1/3 vs 2/6) compare equal; no-pick users sort last
  const pct = (e: UnrankedEntry) => (e.total > 0 ? e.correct / e.total : -1);

  withFlag.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    return pct(b) - pct(a) || b.correct - a.correct || a.displayName.localeCompare(b.displayName);
  });

  let rank = 0;
  return withFlag.map((e, i) => {
    if (!e.qualified) return { ...e, rank: null };
    const prev = withFlag[i - 1];
    const tied = prev?.qualified && prev.correct === e.correct && prev.total === e.total;
    if (!tied) rank = i + 1;
    return { ...e, rank };
  });
}
