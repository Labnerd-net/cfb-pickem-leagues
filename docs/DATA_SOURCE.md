# Data Source Selection

## Overview

The app supports two external data sources for fetching CFB schedules and game results, controlled by the `DATA_SOURCE` environment variable:

- `ncaa` — NCAA API via [ncaa-api.henrygd.me](https://ncaa-api.henrygd.me/openapi) (default)
- `cfbd` — College Football Data via [collegefootballdata.com](https://collegefootballdata.com/) (requires API key)

---

## Recommendation: Which API to Use

**Short answer: stick with `ncaa` unless you have a specific reason to switch.**

### NCAA API (`DATA_SOURCE=ncaa`)

- No API key required
- Returns game data directly from the official NCAA data feed
- Schedule and scoreboard endpoints are the same source used in production today
- Logo endpoint available (see below)
- Unofficial/community-hosted proxy (`ncaa-api.henrygd.me`) — not a guaranteed SLA, but has been stable

### CFBD (`DATA_SOURCE=cfbd`)

- Requires a free API key from collegefootballdata.com
- More developer-friendly API design with better documentation
- Returns richer game metadata (betting lines, win probability, advanced stats) that this app does not currently use
- Has rate limits on the free tier
- No logo data in game responses
- Handles postseason games week-by-week (bowl games, CFP rounds, championship)

### Verdict

For basic regular-season use, the NCAA API covers the core use case without an API key. However, CFBD is the stronger choice if any of the following matter:

- **Playoff/postseason games** — the NCAA implementation as written drops postseason data (see below)
- **Betting spread for admin curation** — NCAA has no lines endpoint
- **Long-term reliability** — CFBD is a dedicated, documented API vs. a community-hosted proxy

---

## Playoff and Postseason Game Support

This is a meaningful difference between the two sources.

### NCAA API — postseason data is dropped

The NCAA schedule response collapses all postseason games into a single trailing aggregate entry rather than returning them week-by-week. The current converter in `packages/backend/src/api/index.ts` explicitly strips this entry:

```ts
// Remove the last entry which is an aggregate summary of all postseason games
const filteredGames = games.slice(0, -1);
```

As a result, bowl games, CFP quarterfinals, semifinals, and the national championship are **not available** through `DATA_SOURCE=ncaa` as currently implemented. Whether the underlying NCAA API exposes per-game postseason data in a different format is unknown, but the current adapter does not handle it.

### CFBD — postseason is fully supported

CFBD returns postseason weeks individually with `seasonType: 'postseason'`. The converter already handles this by offsetting postseason week numbers past the last regular season week:

```ts
if (week.seasonType === 'postseason') {
  data.weekNumber = regularWeekCount + week.week;
}
```

Bowl games and CFP rounds each appear as their own week, ready to be imported and picked against.

### Bottom line

If you plan to run the pick'em through bowls or the CFP, **use CFBD**. The NCAA source will silently omit all postseason games with no error.

---

## Recommendation: Adding Betting Spread to Admin Game Picker

If you want to show betting spread next to each game in the admin game picker (so the admin can identify competitive matchups vs. blowouts), **switch to `DATA_SOURCE=cfbd`**.

The NCAA API has no equivalent betting lines data. CFBD's `/lines` endpoint returns spread, over/under, and moneyline per game and is the only supported path for this feature.

### What changes with CFBD

- Requires a CFBD API key (`CFBD_API_KEY` env var) — you already have one
- Game data flows through `getCfbdGameData()` instead of `getNcaaScoreboard()`
- A supplemental call to the CFBD `/lines` endpoint per week fetches spread data
- `AdminGameData` in shared types gains a nullable `spread` field
- `GameCard.tsx` in the admin UI displays the spread (e.g. "Alabama -28.5" or "Pick'em")
- Falls back gracefully — if CFBD returns no lines for a game, the card shows no spread

### Tradeoff: logos

If team logos are also a priority, CFBD has no logo endpoint. The NCAA API does. You cannot get both betting lines and native logo support from a single data source with the current architecture. Options:

- **CFBD for lines, accept no logos** — simplest path, full spread support
- **CFBD for lines, supplemental NCAA logo lookup** — store logo URLs in a separate `team_logos` table populated from the NCAA API's `/schools-index` and `/logo/{slug}.svg` endpoints; game display components look up logos by team name independently of the data source. Adds complexity but enables both features.
- **NCAA only, no spread** — keeps the current setup, forfeits spread data

### Bottom line

If betting spread for admin game curation is the goal, use CFBD. It is the only viable source for that data. The logo tradeoff is real but manageable via a separate lookup table if logos matter later.

---

## Team Logos

### What's Available

The NCAA API proxy exposes a logo endpoint:

```
GET https://ncaa-api.henrygd.me/logo/{school_slug}.svg
```

Where `{school_slug}` is a URL-safe school identifier (e.g. `alabama`, `ole-miss`, `michigan-state`). The `getNcaaTeamLogo(school)` function in `packages/backend/src/api/ncaa-api.ts` already wraps this endpoint. A full list of schools and their slugs is available from the `/schools-index` endpoint, wrapped by `getNcaaTeams()`.

### Options for Adding Logos

**Option A — Store logo URLs in a `team_logos` table**

Pre-populate a `team_logos` table in the `admin` schema once, using `getNcaaTeams()` to get the slug list and constructing the URL from the known pattern. Game display components look up the logo URL by team name.

| column | type | notes |
|---|---|---|
| `school_name` | text (PK) | canonical display name |
| `school_slug` | text | used to construct the URL |
| `logo_url` | text | full URL to the SVG |

The browser fetches the SVG directly from the NCAA API proxy — no serving infrastructure needed on your end.

**Option B — Store SVG content in the database**

Fetch each SVG and store the raw content in Postgres. Serve it via a new backend endpoint (e.g. `GET /api/logos/:slug`).

This is not recommended. SVG content adds several MB of binary data to the DB, requires a new API route, and forces a manual re-fetch cycle whenever logos change upstream.

### Issues to Be Aware Of

**Name mismatch risk (main concern)**

The logo endpoint uses slugs (`michigan-state`). NCAA scoreboard responses return short display names (`Mich St`). CFBD returns yet another variant (`Michigan State`). These three formats do not automatically align.

You would need an accurate `display_name → slug` mapping. Most major programs are straightforward, but some will require manual correction — teams with unusual short names, schools that have rebranded, etc.

**Third-party dependency**

The logo URLs point to `ncaa-api.henrygd.me`, a community-hosted proxy. If it goes down, logos become broken images. For a 15-user app this is an acceptable risk — just ensure components degrade gracefully to text.

**CFBD cross-source compatibility**

If `DATA_SOURCE=cfbd`, CFBD game responses contain no logo data. However, if you use Option A (URL lookup table), CFBD team names can still be looked up in the logos table — provided the name matching works. This makes the logos feature source-agnostic in principle, though the name mismatch problem is harder to solve for CFBD since CFBD team name formats differ more from NCAA slugs.

### Recommendation

Use Option A (URL table) if you add logos. Build a one-time seed script that calls `getNcaaTeams()`, maps each school's slug to the URL pattern, and populates the table. Display components look up by team name and fall back to text when no logo is found. Accept that a handful of edge-case team names may need manual mapping fixes.

Keep it NCAA-only until the name matching is verified to work reliably across a full season's worth of CFBD game data.
