# Spec: Multi-League — Phase 2: League CRUD & Membership API

## Goal

Add backend routes for creating leagues (site admin), joining via invite code, and managing league membership. No frontend work yet — all endpoints are exercised via API client or tests.

Depends on: Phase 1 schema.

---

## New Middleware

### `requireLeagueMembership(role?: 'admin' | 'member')`
Located in `src/utils/middleware.ts`.

- Reads `leagueId` from the route path param (`:leagueId`)
- Verifies the authenticated user has a row in `league_members` for that league
- If `role = 'admin'` is passed, also verifies `league_members.role = 'admin'`
- Returns 403 if not a member; 404 if the league does not exist
- Stores the resolved membership row on the Hono context (`c.set('leagueMembership', ...)`) for downstream handlers

---

## New Route File: `src/routes/leagues.ts`

Mounted at `/api/leagues`.

### `POST /api/leagues`
Auth: `authMiddleware` + `requireRole('admin')` (site admin only)

Body:
```ts
{ name: string }   // 1–80 chars
```

- Generates a random 8-character alphanumeric `invite_code`
- Inserts into `leagues` with `created_by = currentUserId`
- Auto-adds the creating user to `league_members` as `role = 'admin'`
- Returns the new league object

### `GET /api/leagues`
Auth: `authMiddleware`

- Returns all leagues where the current user has a row in `league_members`
- Includes `role` for each league

### `GET /api/leagues/:leagueId`
Auth: `authMiddleware` + `requireLeagueMembership()`

- Returns league name, invite code (league admin sees it; member does not), member count, created_at

### `POST /api/leagues/join`
Auth: `authMiddleware`

Body:
```ts
{ inviteCode: string }
```

- Looks up league by `invite_code`
- Returns 404 if not found
- Returns 409 if user is already a member
- Inserts user into `league_members` as `role = 'member'`
- Returns the league object

### `GET /api/leagues/:leagueId/members`
Auth: `authMiddleware` + `requireLeagueMembership()`

- Returns list of members with `userId`, `displayName`, `role`, `joinedAt`

### `PATCH /api/leagues/:leagueId/members/:userId`
Auth: `authMiddleware` + `requireLeagueMembership('admin')`

Body:
```ts
{ role: 'admin' | 'member' }
```

- Updates `league_members.role` for the target user
- Blocks demoting yourself if you are the only admin in the league (return 409)

### `DELETE /api/leagues/:leagueId/members/:userId`
Auth: `authMiddleware` + `requireLeagueMembership('admin')`

- Removes user from `league_members`
- Blocks removing yourself if you are the only admin (return 409)
- Does not delete the user's picks for that league (picks are historical)

### `POST /api/leagues/:leagueId/invite/regenerate`
Auth: `authMiddleware` + `requireLeagueMembership('admin')`

- Generates a new random `invite_code` for the league (invalidates the old one)
- Returns the new invite code

---

## New DB Functions (`src/db/dbLeagueFunctions.ts`)

- `createLeague(name, createdBy)` — inserts league + creator as admin member in a transaction; returns new league
- `getLeaguesForUser(userId)` — returns leagues + role for a user
- `getLeagueById(leagueId)` — returns league row or null
- `getLeagueMembership(leagueId, userId)` — returns membership row or null (used by middleware)
- `joinLeague(leagueId, userId)` — inserts member row
- `getLeagueMembers(leagueId)` — returns member list with user display names
- `updateMemberRole(leagueId, userId, role)` — updates role
- `removeMember(leagueId, userId)` — deletes membership row
- `getLeagueAdminCount(leagueId)` — count of admins (used to block last-admin removal/demotion)
- `regenerateInviteCode(leagueId)` — updates and returns new invite code

---

## Shared Types (`packages/shared/types/cfb-pickem-api.ts`)

New types to add:
```ts
export type LeagueRole = 'admin' | 'member';

export interface LeagueData {
  leagueId: number;
  name: string;
  inviteCode?: string;   // only included for league admins
  memberCount: number;
  createdAt: string;
  role: LeagueRole;      // current user's role
}

export interface LeagueMemberData {
  userId: number;
  displayName: string;
  role: LeagueRole;
  joinedAt: string;
}
```

---

## Route Registration (`src/index.ts`)

Mount the new leagues router:
```ts
import leaguesRoute from './routes/leagues.js';
app.route('/api/leagues', leaguesRoute);
```

---

## Acceptance Criteria

- [ ] Site admin can create a league; invite code is auto-generated
- [ ] Creating user is automatically added as league admin
- [ ] Authenticated user can list their leagues
- [ ] Authenticated user can join a league with a valid invite code
- [ ] 404 returned for invalid invite code; 409 for already-a-member
- [ ] League admin can view full member list
- [ ] League admin can change a member's role
- [ ] League admin cannot demote/remove themselves if last admin (409)
- [ ] League admin can regenerate invite code
- [ ] Non-members get 403 on all `/:leagueId` routes
- [ ] `pnpm build` passes

---

## Out of Scope for This Phase

- Any frontend changes
- League-scoped game selection or picks (Phase 3)
- Notification changes (Phase 6)
