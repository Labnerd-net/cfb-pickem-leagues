// Season: a user must have finished picks >= this fraction of the league's highest finished-pick
// count to be ranked by percentage. Prevents e.g. a 1-0 user from topping the board.
export const MIN_PARTICIPATION_RATIO = 0.5;

// Week: sample sizes are too small for a cutoff; anyone with a finished pick is ranked.
export const WEEKLY_MIN_PARTICIPATION_RATIO = 0;

interface Rankable {
  displayName: string;
  correct: number;
  incorrect: number;
}

// Qualified users first (percentage DESC, correct DESC, name), then unqualified in the same
// order with rank null. Users with identical correct and finished counts share a rank (1, 1, 3).
// "Finished" is correct + incorrect, so pending picks never count toward percentage or qualification.
export function rankLeaderboard<T extends Rankable>(
  entries: T[],
  minRatio: number = MIN_PARTICIPATION_RATIO
): (T & { rank: number | null; qualified: boolean })[] {
  const finished = (e: Rankable) => e.correct + e.incorrect;
  const minFinished = Math.max(0, ...entries.map(finished)) * minRatio;

  const withFlag = entries.map(e => ({ ...e, qualified: finished(e) > 0 && finished(e) >= minFinished }));

  // IEEE division is correctly rounded, so equal ratios (1/3 vs 2/6) compare equal; no-pick users sort last
  const pct = (e: Rankable) => (finished(e) > 0 ? e.correct / finished(e) : -1);

  withFlag.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    return pct(b) - pct(a) || b.correct - a.correct || a.displayName.localeCompare(b.displayName);
  });

  let rank = 0;
  return withFlag.map((e, i) => {
    if (!e.qualified) return { ...e, rank: null };
    const prev = withFlag[i - 1];
    const tied = prev?.qualified && prev.correct === e.correct && finished(prev) === finished(e);
    if (!tied) rank = i + 1;
    return { ...e, rank };
  });
}
