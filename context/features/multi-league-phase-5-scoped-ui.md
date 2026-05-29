# Plan: Multi-League Phase 5 — League-Scoped Frontend Screens

## Status Assessment

Phases 3 and 4 already wired `leagueId` into the core user-facing data flows:
- `useWeekNavigation` passes `leagueId` to `getPickedGames` (games load from league pool)
- `usePickSubmit` passes `leagueId` to `getUserPicks` and `postUserPicks`
- `LeaderboardSection` passes `leagueId` to `getLeaderboard` and `getWeekScores`
- All three re-trigger when `activeLeague` changes (it's in effect deps)

Phase 5 completes the remaining work: admin league game management UI, league settings screen, and create-league flow.

---

## Step 1 — API Functions: `adminRequests.ts`

Add 5 new functions for the league admin game management endpoints (all under `/api/admin/leagues`).

Wire types via `InferResponseType` from the Hono RPC client (`client.api.admin.leagues`).

Functions to add:
- `getLeagueGamesForWeek(leagueId, year, weekNumber)` → `GET /:leagueId/games?year=&weekNumber=`
  - Returns `{ games }` array with `inLeague: boolean` per game
  - Export `LeagueGameWire` type from this response
- `addGameToLeague(leagueId, gameId)` → `POST /:leagueId/games/:gameId`
- `removeGameFromLeague(leagueId, gameId)` → `DELETE /:leagueId/games/:gameId`
  - Returns `{ success, error?, status? }` — 409 = has picks
- `markLeagueWeekComplete(leagueId, year, weekNumber)` → `POST /:leagueId/games/complete?year=&weekNumber=`
- `correctLeagueGameScore(leagueId, gameId, homePoints, awayPoints)` → `PATCH /:leagueId/games/:gameId/score`

---

## Step 2 — API Functions: `leagueRequests.ts`

Add 5 new functions for member management and league creation.

Functions to add:
- `getLeagueMembers(leagueId)` → `GET /api/leagues/:leagueId/members`
  - Export `LeagueMemberWire` type from response
- `updateMemberRole(leagueId, userId, role)` → `PATCH /api/leagues/:leagueId/members/:userId`
  - Returns `{ success, error?, status? }` — 409 = last admin
- `removeMember(leagueId, userId)` → `DELETE /api/leagues/:leagueId/members/:userId`
  - Returns `{ success, error?, status? }` — 409 = last admin
- `regenerateInviteCode(leagueId)` → `POST /api/leagues/:leagueId/invite/regenerate`
- `createLeague(name)` → `POST /api/leagues`
  - Returns `{ success, data?: LeagueData & { inviteCode: string }, error? }`

---

## Step 3 — New Component: `LeagueAdminSection.tsx`

`src/components/admin/LeagueAdminSection.tsx`

This is the "League Admin" tab content. It reuses the existing `WeekSelector` for week navigation.

Structure:
- Uses `useLeague()` to get `activeLeague.leagueId`
- Uses `useWeekManagement()` for year/week selector state (weeks are global)
- Own state: `games: LeagueGameWire[]`, `loading`, `error`, `successMessage`, `errorMessage`
- Load effect on `(selectedYear, selectedWeek, leagueId)` — calls `getLeagueGamesForWeek`
- Renders:
  - `WeekSelector` (year + week dropdowns)
  - Game list: for each game, a row with checkbox + team names + start time
    - Checkbox checked when `game.inLeague === true`
    - On check → `addGameToLeague`; on uncheck → `removeGameFromLeague`
    - Uncheck that returns 409 shows inline error (game has picks — cannot remove)
    - Score correction edit icon on games where `game.completed === false && game.inLeague` (reuse score correction dialog pattern from existing `GameCard.tsx`)
  - "Mark Week Complete" button → `markLeagueWeekComplete`; disabled if no `inLeague` games
  - Snackbar for success/error feedback

Score correction sub-dialog: extract the existing score correction dialog from `GameCard.tsx` into a standalone `ScoreCorrectionDialog.tsx` so it can be reused here. The league admin version calls `correctLeagueGameScore` instead of `correctGameScore`.

---

## Step 4 — New Component: `LeagueSettingsSection.tsx`

`src/components/LeagueSettingsSection.tsx`

Accessible from Settings page for league admins.

Contents:
- **League name** — display only (Typography)
- **Invite code** — monospace display + "Copy" icon button (navigator.clipboard); only shown to league admins
- **"Regenerate invite code"** button — opens confirmation dialog before calling `regenerateInviteCode`; updates displayed code on success
- **Member list** — table/list with: Display Name, Role badge (Chip), promote/demote button, remove button
  - Promote: if `role === 'member'`, show "Promote to Admin" → calls `updateMemberRole(leagueId, userId, 'admin')`
  - Demote: if `role === 'admin'` and not self, show "Demote" → calls `updateMemberRole(leagueId, userId, 'member')`; on 409 shows error
  - Remove: calls `removeMember`; on 409 shows error; self-removal not shown
  - After any mutation, re-fetch members list

Props: `leagueId: number`

---

## Step 5 — New Component: `CreateLeagueDialog.tsx`

`src/components/CreateLeagueDialog.tsx`

Site admin only. A modal dialog with:
- TextField: League Name (1–80 chars, validated with Zod inline or simple `trim().length` check)
- Submit calls `createLeague(name)`
- On success:
  - Show a second step within the dialog: "League created! Share this invite code: `{inviteCode}`" with copy button
  - Close button calls `onCreated(newLeague)` prop

Props:
```ts
interface CreateLeagueDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (league: LeagueData) => void;
}
```

---

## Step 6 — Dashboard.tsx: Add "League Admin" Tab

Add a conditional "League Admin" tab between "My Dashboard" and "Admin Controls":
- Visible when `activeLeague?.role === 'admin'`
- Tab label: "League Admin", icon: `<GroupsIcon />`
- Content: `<LeagueAdminSection />`

Tab index management: the tab array is currently hardcoded index-based. After adding the league admin tab (conditional), use the existing tab-descriptor array pattern (already used via `tabComponents[currentTab]`).

**Implementation approach**: build the tab list conditionally before rendering:
```ts
const isLeagueAdmin = activeLeague?.role === 'admin';
// build tabs array with conditional entry
```

This avoids index drift bugs when the tab is conditionally absent.

---

## Step 7 — Settings.tsx: League Admin Controls

In the existing "Leagues" section:
- For each league where `league.role === 'admin'`, show a "Manage" icon button next to the league name
- Clicking "Manage" opens `LeagueSettingsSection` in a fullscreen or large dialog (or inline expand — use Dialog for simplicity)
- For site admins (`user?.roles.includes('admin')`): add "Create League" button that opens `CreateLeagueDialog`
  - On created: call `refetchLeagues()` then `setActiveLeague(newLeague)`

---

## Step 8 — Extract `ScoreCorrectionDialog.tsx`

`src/components/admin/ScoreCorrectionDialog.tsx`

Extract the score correction dialog JSX from `GameCard.tsx` into a standalone component to enable reuse in `LeagueAdminSection`.

Props:
```ts
interface ScoreCorrectionDialogProps {
  open: boolean;
  game: { gameId: number; homeTeam: string; awayTeam: string; homePoints: number | null; awayPoints: number | null };
  onClose: () => void;
  onSave: (homePoints: number, awayPoints: number) => Promise<void>;
}
```

`GameCard.tsx` delegates to this component; `LeagueAdminSection.tsx` also uses it but wires `onSave` to `correctLeagueGameScore`.

---

## File Checklist

**New files:**
- `src/components/admin/LeagueAdminSection.tsx`
- `src/components/admin/ScoreCorrectionDialog.tsx` (extracted from GameCard)
- `src/components/LeagueSettingsSection.tsx`
- `src/components/CreateLeagueDialog.tsx`

**Modified files:**
- `src/apis/adminRequests.ts` — add 5 league game management functions + `LeagueGameWire` type
- `src/apis/leagueRequests.ts` — add 5 member management + create functions
- `src/components/admin/GameCard.tsx` — delegate score dialog to `ScoreCorrectionDialog`
- `src/pages/Dashboard.tsx` — add conditional League Admin tab
- `src/pages/Settings.tsx` — add "Manage" per-league + "Create League" for site admins

---

## Order of Implementation

1. `ScoreCorrectionDialog.tsx` extraction + `GameCard.tsx` update (isolated, enables reuse)
2. API functions in `adminRequests.ts`
3. API functions in `leagueRequests.ts`
4. `LeagueAdminSection.tsx`
5. `LeagueSettingsSection.tsx`
6. `CreateLeagueDialog.tsx`
7. `Dashboard.tsx` tab addition
8. `Settings.tsx` league admin controls
9. `pnpm build` — fix any TypeScript errors

---

## Acceptance Criteria Mapping

| Criterion | Implementation |
|-----------|---------------|
| Picks/games scoped to league | Already done (Phase 3/4) |
| League switch triggers reload | Already done (leagueId in effect deps) |
| Leaderboard scoped to league | Already done (Phase 4) |
| League Admin tab with game selection | Steps 2 + 4 |
| Check/uncheck games via API | Step 4 |
| 409 uncheck error shown | Step 4 |
| Score correction per-league | Steps 1 + 4 (via extracted dialog) |
| League settings: invite code + members | Step 5 |
| Last-admin guard in UI | Step 5 (409 error from API) |
| Site admin can create league | Step 6 |
| Build passes, no TS errors | Step 9 |
