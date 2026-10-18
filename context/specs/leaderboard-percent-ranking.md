# Leaderboard Percent Ranking

Season leaderboard ranks by pick percentage instead of correct count. Picks are optional, so skipped games don't count against anyone.

## Rules
- Percentage = correct / (correct + incorrect). Pending and voided picks excluded.
- Qualification: finished picks >= 50% of the highest finished-pick count in the league (MIN_PARTICIPATION_RATIO).
- Qualified users ranked by percentage DESC, then correct DESC, then displayName.
- Ties (same correct and same total) share a rank; next rank skips (1, 1, 3).
- Unqualified users are listed below qualified ones (sorted the same way) with no rank ("—").

## Acceptance
- A 1-0 user does not outrank a 60-15 user.
- Rank column reflects shared ranks.
