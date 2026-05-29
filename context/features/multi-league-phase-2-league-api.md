# Plan: Multi-League Phase 2 — League CRUD & Membership API

## Context

Phase 1 added the `leagues`, `league_members`, and `league_games` tables. Phase 2 wires up the backend routes and DB layer so leagues can be created, joined, and managed. No frontend changes — backend only. This phase introduces a new `requireLeagueMembership` middleware and a dedicated `dbLeagueFunctions.ts` file.

---

## 1. Shared Types (`packages/shared/types/cfb-pickem-api.ts`)

Append after the existing `UserData` / `AdminGameData` block:

```ts
export type LeagueRole = 'admin' | 'member';

export interface LeagueData {
  leagueId: number;
  name: string;
  inviteCode?: string;   // present only when current user is league admin
  memberCount: number;
  createdAt: string;
  role: LeagueRole;
}

export interface LeagueMemberData {
  userId: number;
  displayName: string;
  role: LeagueRole;
  joinedAt: string;
}
```

---

## 2. DB Functions (`packages/backend/src/db/dbLeagueFunctions.ts`) — new file

Imports: `db` from `./index.js`; `leagues`, `leagueMembers` from `./schema/leagues.js`; `users` from `./schema/users.js`; Drizzle helpers (`eq`, `and`, `count`, `sql`); logger from `../utils/logger.js`.

Invite code helper (module-private):
```ts
function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex'); // 8-char lowercase hex
}
```
Use Node's built-in `crypto` — no extra dependency.

Functions:

| Function | Query | Notes |
|---|---|---|
| `createLeague(name, createdBy)` | `db.transaction()` — insert `leagues`, then insert `league_members` as admin | Returns full league row |
| `getLeaguesForUser(userId)` | join `leagueMembers` + `leagues`, filter `userId` | Returns `{ league, role, memberCount }[]` — memberCount via subquery |
| `getLeagueById(leagueId)` | select `leagues` where `leagueId` | Returns row or `undefined` |
| `getLeagueMembership(leagueId, userId)` | select `leagueMembers` where both match | Returns row or `undefined`; used by middleware |
| `joinLeague(leagueId, userId)` | insert `leagueMembers` as `'member'` | Returns inserted row |
| `getLeagueMembers(leagueId)` | join `leagueMembers` + `users` on `userId` | Returns `{ userId, displayName, role, joinedAt }[]` |
| `getLeagueMemberCount(leagueId)` | count `leagueMembers` where `leagueId` | Returns number |
| `updateMemberRole(leagueId, userId, role)` | update `leagueMembers` | Returns updated row |
| `removeMember(leagueId, userId)` | delete from `leagueMembers` | void |
| `getLeagueAdminCount(leagueId)` | count `leagueMembers` where `role='admin'` | Returns number; used to guard last-admin operations |
| `regenerateInviteCode(leagueId)` | update `leagues` set `inviteCode = generateInviteCode()` | Returns new invite code string |
| `getLeagueByInviteCode(inviteCode)` | select `leagues` where `inviteCode` | Returns row or `undefined` |

All functions: try/catch with `logger.error({ err }, 'functionName failed')` — same pattern as `dbAdminFunctions.ts`.

---

## 3. Validators (`packages/backend/src/utils/zValidate.ts`)

Add these exports at the bottom of the file:

```ts
// League validators
const createLeagueSchema = z.object({ name: z.string().trim().min(1).max(80) });
export const createLeagueValidator = zValidator('json', createLeagueSchema);

const joinLeagueSchema = z.object({ inviteCode: z.string().trim().min(1) });
export const joinLeagueValidator = zValidator('json', joinLeagueSchema);

const leagueIdParamSchema = z.object({ leagueId: z.coerce.number().int().positive() });
export const leagueIdParamValidator = zValidator('param', leagueIdParamSchema);

const memberParamSchema = z.object({
  leagueId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});
export const memberParamValidator = zValidator('param', memberParamSchema);

const updateMemberRoleSchema = z.object({ role: z.enum(['admin', 'member']) });
export const updateMemberRoleValidator = zValidator('json', updateMemberRoleSchema);
```

---

## 4. Middleware (`packages/backend/src/utils/middleware.ts`)

Add `requireLeagueMembership` following the same factory pattern as `requireRole`:

```ts
export const requireLeagueMembership = (requiredRole?: 'admin') => {
  return async (c: Context, next: Next) => {
    const payload: JwtData = c.get('jwtPayload');
    const leagueId = Number(c.req.param('leagueId'));
    if (!leagueId) throw new HTTPException(400, { message: 'Missing leagueId' });

    const league = await getLeagueById(leagueId);
    if (!league) throw new HTTPException(404, { message: 'League not found' });

    const membership = await getLeagueMembership(leagueId, payload.sub);
    if (!membership) throw new HTTPException(403, { message: 'Forbidden' });
    if (requiredRole === 'admin' && membership.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    c.set('leagueMembership', membership);
    await next();
  };
};
```

Import `getLeagueById` and `getLeagueMembership` from `../db/dbLeagueFunctions.js`.

---

## 5. Route File (`packages/backend/src/routes/leagues.ts`) — new file

Middleware order on each route: `apiRateLimit → authMiddleware → [requireLeagueMembership] → [zValidator] → handler`.

**Note on route ordering:** `POST /join` must be registered before parameterized routes to avoid Hono matching `join` as a leagueId.

Endpoint summary:

| Method | Path | Middleware chain | Handler notes |
|---|---|---|---|
| `POST /` | create league | `authMiddleware, requireRole('admin'), createLeagueValidator` | call `createLeague(name, payload.sub)`; return `{ league }` |
| `GET /` | list my leagues | `authMiddleware` | call `getLeaguesForUser(payload.sub)`; return `{ leagues }` |
| `POST /join` | join via code | `authMiddleware, joinLeagueValidator` | lookup → 404; check existing → 409; insert; return `{ league }` |
| `GET /:leagueId` | get league | `authMiddleware, leagueIdParamValidator, requireLeagueMembership()` | include `inviteCode` only if `membership.role === 'admin'` |
| `GET /:leagueId/members` | list members | `authMiddleware, leagueIdParamValidator, requireLeagueMembership()` | return `{ members }` |
| `PATCH /:leagueId/members/:userId` | change role | `authMiddleware, memberParamValidator, requireLeagueMembership('admin'), updateMemberRoleValidator` | 409 on last-admin demotion |
| `DELETE /:leagueId/members/:userId` | remove member | `authMiddleware, memberParamValidator, requireLeagueMembership('admin')` | 409 on last-admin removal |
| `POST /:leagueId/invite/regenerate` | regen invite | `authMiddleware, leagueIdParamValidator, requireLeagueMembership('admin')` | return `{ inviteCode }` |

---

## 6. Mount in `packages/backend/src/index.ts`

```ts
import leaguesRoute from './routes/leagues.js';
// add to routes chain:
.route('/api/leagues', leaguesRoute)
```

---

## 7. Test Setup & Tests

Check `packages/backend/tests/setup.ts` — if it manually creates tables, add `leagues` and `league_members` CREATE TABLE statements. If it uses migrations, no change needed.

Write `packages/backend/tests/routes/leagues.test.ts` covering:
- `POST /api/leagues` — 201 (admin), 403 (non-admin)
- `GET /api/leagues` — returns only user's leagues
- `POST /api/leagues/join` — 200, 404 (bad code), 409 (already member)
- `GET /api/leagues/:leagueId` — 200 member/admin (invite code visibility differs), 403 non-member
- `GET /api/leagues/:leagueId/members` — 200 (member), 403 (non-member)
- `PATCH /api/leagues/:leagueId/members/:userId` — role change; 409 last-admin demotion
- `DELETE /api/leagues/:leagueId/members/:userId` — remove; 409 last-admin removal
- `POST /api/leagues/:leagueId/invite/regenerate` — new code returned

---

## Verification

1. `pnpm build` — no TypeScript errors
2. `pnpm test` — all existing + new league route tests pass
