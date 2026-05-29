# Spec: Multi-League Support

## Summary

Convert the single-tenant CFB Pick'em app into a shared platform where independent groups each run their own pick'em league on the same instance. Each league has its own game selection, its own picks, and its own leaderboard, while sharing a single global CFBD game cache.

---

## Decisions Made

| Question | Decision |
|---|---|
| Who creates leagues? | Site super-admin only (existing `admin` role) |
| Multi-league membership? | Yes — users can belong to multiple leagues; frontend needs a league switcher |
| Global game cache vs. per-league import? | Shared global cache (Option A); league admins pick from it |
| Super-admin vs. league admin? | Separate roles — `admin` role = site super-admin; league admin = `league_members.role` |
| Notification scope? | All members of a league when league admin marks games complete |

---

## Schema Changes

### New Tables

**`public.leagues`**
```
league_id    serial PK
name         text NOT NULL
invite_code  text NOT NULL UNIQUE  -- random slug for join URL
created_by   integer FK → user.users.user_id
created_at   timestamp DEFAULT now()
```

**`public.league_members`**
```
league_id    integer FK → leagues.league_id  ┐ composite PK
user_id      integer FK → user.users.user_id ┘
role         text NOT NULL  -- 'admin' | 'member'
joined_at    timestamp DEFAULT now()
```

**`public.league_games`** (replaces `admin.games.picked`)
```
league_id    integer FK → leagues.league_id  ┐ composite PK
game_id      integer FK → admin.games.game_id┘
added_at     timestamp DEFAULT now()
```

### Modified Tables

**`admin.games`** — remove the `picked` boolean column. Game selection is now per-league via `league_games`.

**`user.games` (picks)** — add `league_id` column. New composite PK: `(user_id, game_id, league_id)`.

### Unchanged Tables

- `admin.weeks` — global calendar weeks; all leagues share the same week boundaries
- `admin.games` (rest of columns) — global CFBD cache; `completed`, `winningTeam`, scores are universal facts
- `user.users` — roles array stays as-is; `admin` = site super-admin

---

## Role Model

| Role | Where Stored | What It Can Do |
|---|---|---|
| `admin` (site) | `user.users.roles` array | Import CFBD games, create leagues, manage global cache |
| `admin` (league) | `league_members.role` | Select games from global cache for their league, mark games complete for their league |
| `member` (league) | `league_members.role` | Submit picks for that league, view league leaderboard |

A site admin can also be a league admin — they appear in `league_members` like anyone else.

---

## Implementation Phases

Each phase has its own spec file and gets its own branch.

| Phase | Spec | Scope |
|---|---|---|
| 1 | [multi-league-phase-1-schema.md](multi-league-phase-1-schema.md) | Schema + Drizzle migration; default league data seed |
| 2 | [multi-league-phase-2-league-api.md](multi-league-phase-2-league-api.md) | League CRUD, invite/join, membership management (backend only) |
| 3 | [multi-league-phase-3-scoped-routes.md](multi-league-phase-3-scoped-routes.md) | League-scoped game selection, picks, leaderboard routes (backend only) |
| 4 | [multi-league-phase-4-league-switcher.md](multi-league-phase-4-league-switcher.md) | LeagueContext, league switcher in header, join flow (frontend) |
| 5 | [multi-league-phase-5-scoped-ui.md](multi-league-phase-5-scoped-ui.md) | All screens scoped to active league; league admin game selection UI; league settings (frontend) |
| 6 | [multi-league-phase-6-notifications.md](multi-league-phase-6-notifications.md) | Notifications scoped to league members; per-league cron reminders |

---

## Out of Scope (entire feature)

- Per-user notification opt-in per league (future)
- Public league discovery (all leagues require invite code)
- League deletion / archiving
- Picking games against the spread (existing spread field is already a placeholder)
