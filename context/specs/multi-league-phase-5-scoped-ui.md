# Spec: Multi-League — Phase 5: League-Scoped Frontend Screens

## Goal

Update all existing frontend screens to operate within the active league context. Add league admin game selection UI and league management screens. After this phase the app is fully multi-league functional end-to-end.

Depends on: Phase 3 (backend scoped routes), Phase 4 (LeagueContext + switcher).

---

## Principle

Every API call that previously had no league context now passes `activeLeague.leagueId` (from `LeagueContext`). When the active league changes, all screens reload their data. This is achieved by including `activeLeagueId` in the dependency arrays of the relevant `useEffect` hooks.

---

## Modified Screens

### Picks Screen (`WeekGameSection.tsx` / `useWeekGames.ts`)

- Pass `leagueId` to `GET /api/user/picks` and `POST /api/user/picks`
- Games displayed are from the league's pool (`GET /api/user/leagues/:leagueId/games` for the week), not the full global cache
- When active league changes, picks and games reload

### Results Screen

- Pass `leagueId` to `GET /api/user/results`
- Results filtered to the active league

### Leaderboard Screen (`LeaderboardSection.tsx`)

- Pass `leagueId` to `GET /api/leaderboard` and `GET /api/leaderboard/scores`
- Leaderboard shows only members of the active league

---

## Admin Screen Changes

The admin section must distinguish between two admin roles:

### Site Admin Tab (existing, unchanged purpose)
- Import CFBD games (global cache) — unchanged
- Manage weeks — unchanged
- User management — unchanged
- Notification log — unchanged
- Delete year data — unchanged

### League Admin Tab (new tab, visible to league admins)
- Shown when the current user has `role = 'admin'` in `LeagueContext.activeLeague`
- Contains: game selection, mark-complete, score correction

#### Game Selection Panel
- Week selector (same as existing admin week selector)
- Shows all games from the global cache for the week, each with a checkbox
- Checkbox state = `inLeague` from `GET /api/admin/leagues/:leagueId/games`
- Checking a game calls `POST /api/admin/leagues/:leagueId/games/:gameId`
- Unchecking calls `DELETE /api/admin/leagues/:leagueId/games/:gameId`
- If a game has picks, unchecking shows a confirmation warning (409 from the API prevents it)

#### Mark Games Complete
- Button: "Mark Week Complete"
- Calls `POST /api/admin/leagues/:leagueId/games/complete`
- Same UX as the existing single-tenant button

#### Score Correction
- Per-game edit icon on picked games
- Calls `PATCH /api/admin/leagues/:leagueId/games/:gameId/score`
- Same dialog as existing score correction

---

## New Screens

### League Settings (league admin only)
New component: `src/components/LeagueSettingsSection.tsx`

Accessible via a gear icon or menu item next to the league switcher.

Contents:
- League name (display only for now)
- Invite code display with a copy button
- "Regenerate invite code" button (with confirmation)
- Member list with role badges
  - Promote/demote button per member (league admin only)
  - Remove member button (league admin only; blocked for last admin)

### Create League (site admin only)
New component: `src/components/CreateLeagueDialog.tsx`

- Form: league name (1–80 chars)
- Submit calls `POST /api/leagues`
- On success: new league appears in the switcher and becomes active; invite code is shown once in a success dialog so the admin can share it

---

## API Function Updates (`src/apis/`)

### `userRequests.ts`
- `getWeekPicks(leagueId, ...)` — add `leagueId` param
- `submitPicks(leagueId, ...)` — add `leagueId` to body
- `getWeekResults(leagueId, ...)` — add `leagueId` param

### `leaderboardRequests.ts`
- `getLeaderboard(leagueId, ...)` — add `leagueId`
- `getWeekScores(leagueId, ...)` — add `leagueId`

### `adminRequests.ts`
- Add league game selection functions:
  - `getLeagueGamesForWeek(leagueId, year, weekNumber, seasonType)`
  - `addGameToLeague(leagueId, gameId)`
  - `removeGameFromLeague(leagueId, gameId)`
  - `markLeagueWeekComplete(leagueId, year, weekNumber, seasonType)`
  - `correctLeagueGameScore(leagueId, gameId, homePoints, awayPoints)`

### `leagueRequests.ts` (from Phase 4, extended)
- `updateMemberRole(leagueId, userId, role)`
- `removeMember(leagueId, userId)`
- `regenerateInviteCode(leagueId)`
- `createLeague(name)` (site admin)

---

## Acceptance Criteria

- [ ] Picks screen shows only games in the active league's pool for the week
- [ ] Submitting picks attaches the active `leagueId`
- [ ] Switching leagues causes picks and games to reload
- [ ] Leaderboard shows only members of the active league
- [ ] Week leaderboard scores are scoped to active league
- [ ] League admin sees a "League Admin" tab with game selection and mark-complete
- [ ] Checking/unchecking games updates the league pool via API
- [ ] Attempting to uncheck a game with picks shows an error (API returns 409)
- [ ] Score correction works per-league
- [ ] League settings page shows invite code, member list, promote/demote/remove
- [ ] Last-admin demotion/removal blocked in UI (mirrors API 409)
- [ ] Site admin can create a league and share the invite code
- [ ] `pnpm build` passes; no TypeScript errors

---

## Out of Scope for This Phase

- Notifications (Phase 6)
- Public league discovery
- League renaming
