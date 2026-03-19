# Sport Expansion API Research

Research into potential sports to add beyond college football, focusing on available APIs and fit with the current app architecture.

---

## Current Architecture Constraints

- **Week-based model**: `WeekQuery` uses `{ year, weekNumber, seasonType }`. Works naturally for football.
- **DB schema**: `admin.weeks` has `weekNumber`, `seasonType` — football-centric concepts.
- **Data sources**: App supports `DATA_SOURCE` env var pointing to `ncaa`, `cfbd`, or `sdv` adapters.
- **`sportsdataverse` package** (`sdv`) is already installed and includes modules for NFL, MLB, NBA, NHL, MBB, WBB, WNBA, and tennis.

---

## NFL

**Fit: Excellent — near drop-in**

### API
- `sportsdataverse` (`sdv.nfl`) — ESPN-sourced, already installed.
- Key method: `sdv.nfl.getWeeklySchedule({ week, year, seasonType })` — same signature as CFB.
- Also has `getScoreboard`, `getSchedule`, `getSummary`, `getBoxScore`, `getPlayByPlay`.

### Week Structure
- Regular season: 18 weeks
- Postseason: Wild Card, Divisional, Championship, Super Bowl
- Maps directly to the existing `weekNumber` + `seasonType` model.

### Volume
- ~16 games per week (regular season) — manageable for a pick'em format.

### Effort to Add
- Write an NFL converter in `src/api/index.ts` (normalize `sdv.nfl` output to shared types).
- Add `DATA_SOURCE=nfl` option.
- Minimal schema changes needed.

---

## MLB (Major League Baseball)

**Fit: Moderate — requires date-based rework**

### API Options
1. **MLB Stats API** (`statsapi.mlb.com/api/v1`) — Official, free, no API key required.
   - Example: `GET /schedule?sportId=1&date=2025-04-15`
   - Returns game status (scheduled/in-progress/final), scores, team IDs, venue.
   - `sportId=1` = MLB; minor leagues have separate IDs.
   - No published rate limit; well-documented.
2. **`sportsdataverse` (`sdv.mlb`)** — ESPN-sourced, already installed. Consistent with existing SDV adapter pattern.

### Season Structure
- ~162 games per team, Feb–Oct (including postseason).
- Games played daily, not weekly.
- No natural "week" concept — pick periods would need to be day, series, or an arbitrary date range.

### Volume
- Hundreds of games on any given day across D1/MLB — curation layer is critical.

### Effort to Add
- Date-based query model doesn't map to `WeekQuery` — schema changes needed.
- Admin UI would need a way to define pick periods by date range rather than week number.
- High volume requires strong admin curation workflow.

---

## College Baseball (NCAA)

**Fit: Poor — same issues as MLB plus less API support**

### API
- `ncaa-api.henrygd.me` (same unofficial NCAA proxy used for CFB).
- Sport slug is likely `baseball` — **not confirmed**.
- Scoreboard path would use `YYYY/MM` date format instead of week numbers.

### Season Structure
- ~56 games per team, Feb–June.
- Daily schedule, no weeks.
- Same date-based model problem as MLB.

### Volume
- Hundreds of D1 games per day during the season.

### Effort to Add
- Same schema rework as MLB.
- Less reliable API (unofficial proxy).
- Smaller audience interest vs. MLB or NFL.

---

## Comparison Summary

| Sport | API | Week-based? | Schema Changes | Relative Effort |
|---|---|---|---|---|
| NFL | `sdv.nfl` (ESPN) | Yes | Minimal | Low |
| MLB | MLB Stats API or `sdv.mlb` | No (daily) | Significant | High |
| College Baseball | `ncaa-api.henrygd.me` | No (daily) | Significant | High |

---

## Other Sports Available via `sportsdataverse`

The installed package also includes: `mbb` (men's basketball), `wbb`, `nba`, `nhl`, `wnba`, `tennis`. All are date-based except possibly NHL (which has a week-adjacent structure). None were researched in depth.
