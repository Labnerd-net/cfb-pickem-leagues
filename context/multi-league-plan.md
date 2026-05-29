# Multi-League CFB Pick'em — Context & Plan

## Why This Repo Exists

This is a fork of `cfb-pickem` (https://github.com/Labnerd-net/cfb-pickem), which is a single-tenant College Football Pick'em app. The goal here is to convert it into a shared platform where independent groups can each run their own pick'em league on the same instance — same codebase, same server, isolated competition.

---

## The Core Architectural Change

The original app assumes one of everything: one game catalog, one set of picks, one leaderboard, one admin. This repo adds the concept of a **league** — a named group with its own admin(s), its own game selection each week, its own picks, and its own leaderboard.

This is a schema-level change that touches nearly every layer.

---

## What Changes

### New Tables Needed

- **`leagues`** — `league_id`, `name`, `invite_code`, `created_by`, timestamps
- **`league_members`** — `(league_id, user_id)`, `role` (admin / member)

### Tables That Gain `league_id`

- **`admin.weeks`** — currently global; becomes per-league
- **`admin.games`** — the `picked` flag is currently global; becomes per-league game selection
- **`user.games`** (picks) — currently `(userId, gameId)`; becomes `(userId, gameId, leagueId)`
- **Roles** — currently global admin; becomes per-league admin (with optional site-level super-admin)
- **Notifications** — game-complete emails need league context at minimum

### What Stays the Same

- Auth mechanism (JWT, httpOnly cookie)
- CFBD integration (external game data source)
- Frontend component structure
- Hono RPC client pattern

---

## Key Design Decision: Shared Game Cache vs. Per-League Import

The raw game data comes from CFBD (College Football Data API). Two approaches:

**Option A (recommended): Shared global cache + per-league selection**
- `admin.games` stores raw CFBD data globally (one fetch feeds all leagues)
- A `league_games` join table (or a `leagueId` on `admin.games`) tracks which games each league admin has selected for their pool
- Avoids redundant API calls; all leagues see the same underlying games

**Option B: Fully isolated per-league import**
- Each league independently imports from CFBD
- More isolated but wasteful and harder to maintain

Recommendation: go with Option A.

---

## Open Questions to Resolve Before Starting

1. **Who can create a league?** Any registered user, or a site-level super-admin you control?
2. **Can a user belong to multiple leagues?** If yes, the frontend needs a league switcher and every API call needs to carry active league context (in the JWT or as a query param).
3. **Global game cache or per-league import?** (See above — recommendation is shared cache.)
4. **Notification scope:** Should game-complete notifications go to all members of a league, or remain a per-user opt-in per-league?
5. **Super-admin role:** Should there be a site-level admin distinct from league admins who can manage the global game cache?

---

## Suggested Implementation Order

1. Resolve the open questions above
2. Design the new schema (leagues, league_members, league_id FKs)
3. Write and run migrations
4. Update backend routes — thread league context through all queries
5. Update frontend — league switcher, league-scoped leaderboard, team management UI
6. Update auth — JWT or session needs active league context
7. Update notifications — scope to league membership
8. Test end-to-end with two independent leagues on the same instance

---

## Reference

- Original repo: https://github.com/Labnerd-net/cfb-pickem
- This repo: https://github.com/Labnerd-net/cfb-pickem-leagues
