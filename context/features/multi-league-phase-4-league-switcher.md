# Plan: Multi-League Phase 4 — Frontend League Switcher & Join Flow

## Context

Phase 3 added `leagueId` to all backend routes and hardcoded `leagueId: '1'` in 4 frontend API shims as a bridge. Phase 4 replaces those shims with a real `LeagueContext` that fetches the user's leagues, tracks the active selection in localStorage, and injects `leagueId` into all API calls. No picks/results/leaderboard screens are league-aware yet (Phase 5).

---

## 1. New API File — `src/apis/leagueRequests.ts`

Use the Hono RPC client (`client.api.leagues...`). Do not use `fetch` directly.

```ts
getLeagues()                    // GET  /api/leagues          → { leagues: LeagueData[] }
joinLeague(inviteCode: string)  // POST /api/leagues/join     → { league: LeagueData }
```

`getLeague(leagueId)` and `getLeagueMembers(leagueId)` are spec'd but not needed until Phase 5; omit for now.

Response shape: use `InferResponseType<>` aliases as done in `adminRequests.ts`. Export an `extractError` helper consistent with other request files.

---

## 2. `LeagueContext` — `src/contexts/LeagueContext.tsx`

Single file containing the context definition, provider, and `useLeague` hook.

```ts
interface LeagueContextValue {
  leagues: LeagueData[];
  activeLeague: LeagueData | null;
  setActiveLeague: (league: LeagueData) => void;
  isLoading: boolean;
  refetchLeagues: () => Promise<void>;
}
```

**Provider behavior:**
- Reads `useAuth()` to know when auth has resolved (`!isLoading && user !== null`)
- On auth-resolve, calls `getLeagues()` and stores result in state
- Reads `localStorage.getItem('activeLeagueId')` on load; if that `leagueId` is in the fetched list, selects it — otherwise defaults to `leagues[0]`
- `setActiveLeague` updates state and writes `localStorage.setItem('activeLeagueId', String(league.leagueId))`
- When `user` becomes `null` (logout), resets `leagues = []`, `activeLeague = null`, clears localStorage key
- `isLoading` is `true` until the first fetch completes (or auth has no user)
- `refetchLeagues` re-runs the fetch and re-applies the localStorage restore logic (needed after `joinLeague`)

**Hook:** `useLeague()` — throws if used outside provider.

---

## 3. Wire `LeagueProvider` into `App.tsx`

Current tree:
```
ThemeProvider > AuthProvider > ErrorBoundary > BrowserRouter > ...
```

New tree:
```
ThemeProvider > AuthProvider > LeagueProvider > ErrorBoundary > BrowserRouter > ...
```

`LeagueProvider` goes between `AuthProvider` and `ErrorBoundary` so it has access to `useAuth()` and wraps everything that needs league data (Navbar, routes).

---

## 4. `LeagueSwitcher` — `src/components/LeagueSwitcher.tsx`

Rendered in `Navbar.tsx` between the spacer and the user display name.

- Only renders when `user` is authenticated (`useAuth`) and `leagues.length > 0`
- **1 league:** render the league name as a `Typography` label (no dropdown)
- **2+ leagues:** render a MUI `Select` (compact, no full-width) showing the active league name; `onChange` calls `setActiveLeague`
- Style: fits inline in the Toolbar without adding vertical height — use `size="small"` variant, match the existing Navbar color scheme (`text.primary`, no border surprise)
- Does not trigger a page reload; downstream components will react to context change in Phase 5

---

## 5. No-League Gate

When `activeLeague === null` and `!isLoading`, the user has no leagues. Gate is applied at the top of `Dashboard.tsx`:

```tsx
// top of Dashboard component body
const { activeLeague, isLoading: leagueLoading } = useLeague();
if (leagueLoading) return <LoadingSpinner />;   // or null
if (!activeLeague) return <JoinLeaguePrompt onJoined={refetchLeagues} />;
```

Putting the gate in `Dashboard` (not `App.tsx`) means:
- Navbar still renders (user can still logout)
- Settings page is still accessible (needed for the "Join another league" button)
- Only the dashboard content is replaced

---

## 6. `JoinLeaguePrompt` — `src/components/JoinLeaguePrompt.tsx`

Full-page centered card shown when `activeLeague === null`:
- Heading: "You're not in any league yet"
- Subtext: "Enter an invite code to join one."
- Single text input (trimmed, uppercase-normalized before submit) + Submit button
- On success: calls `refetchLeagues()` from `LeagueContext` (passed as `onJoined` prop), which re-fetches and auto-selects the new league
- Error states: "Invalid invite code" (404), "You're already in this league" (409), generic fallback

---

## 7. `JoinLeagueDialog` — `src/components/JoinLeagueDialog.tsx`

Modal dialog for users who already have a league and want to join another. Same form as `JoinLeaguePrompt` but in a dialog.

Add a "Join League" button to `Settings.tsx` (bottom of the page, or in a new "Leagues" section) that opens this dialog. On success, calls `refetchLeagues()`.

---

## 8. Replace Frontend API Shims

Four locations with hardcoded `leagueId: '1'`:

| File | Function | Change |
|---|---|---|
| `userRequests.ts` | `getUserPicks` | `leagueId: String(activeLeague.leagueId)` |
| `userRequests.ts` | `getPickedGames` | same |
| `userRequests.ts` | `getUserPickHistory` | same |
| `leaderboardRequests.ts` | `getLeaderboard` | same |
| `leaderboardRequests.ts` | `getWeekScores` | same |

These functions currently don't have access to `activeLeague`. The cleanest approach for Phase 4 is to **add a `leagueId: number` parameter** to each function — callers in Phase 5 will pass `activeLeague.leagueId`. For Phase 4, update each call site (hooks: `usePickSubmit`, `useWeekNavigation`, `LeaderboardSection`) to read `activeLeague?.leagueId ?? 1` from `useLeague()` and pass it through.

This avoids making the API functions depend on React context directly (bad pattern) while still wiring things up correctly.

**`adminRequests.ts` shim** (`setPickedGames`) — already stubbed out for Phase 4; no change needed.

---

## 9. Call Sites to Update

| File | Change |
|---|---|
| `src/components/user/usePickSubmit.ts` | Add `useLeague()`, pass `leagueId` to `getUserPicks` / `submitPicks` |
| `src/components/user/useWeekNavigation.ts` | Add `useLeague()`, pass `leagueId` to `getPickedGames` |
| `src/components/dashboard/LeaderboardSection.tsx` (or wherever `getLeaderboard`/`getWeekScores` are called) | Add `useLeague()`, pass `leagueId` |

---

## 10. Tests

- `leagueRequests.ts`: add MSW handlers for `GET /api/leagues` and `POST /api/leagues/join`; add API request tests
- `LeagueSwitcher.tsx`: unit test — renders static label for 1 league, dropdown for 2+; switching calls `setActiveLeague`
- `JoinLeaguePrompt.tsx` / `JoinLeagueDialog.tsx`: unit test — submit with valid code calls `joinLeague` and `onJoined`; 404/409 show inline errors

No backend tests needed — this is frontend-only.

---

## 11. File Summary

| Action | File |
|---|---|
| Create | `src/apis/leagueRequests.ts` |
| Create | `src/contexts/LeagueContext.tsx` |
| Create | `src/components/LeagueSwitcher.tsx` |
| Create | `src/components/JoinLeaguePrompt.tsx` |
| Create | `src/components/JoinLeagueDialog.tsx` |
| Modify | `src/App.tsx` — add `LeagueProvider` |
| Modify | `src/components/navbar/Navbar.tsx` — add `<LeagueSwitcher />` |
| Modify | `src/pages/Dashboard.tsx` — add league gate |
| Modify | `src/pages/Settings.tsx` — add Join League button/dialog |
| Modify | `src/apis/userRequests.ts` — add `leagueId` param to 3 functions |
| Modify | `src/apis/leaderboardRequests.ts` — add `leagueId` param to 2 functions |
| Modify | `src/components/user/usePickSubmit.ts` — wire `leagueId` |
| Modify | `src/components/user/useWeekNavigation.ts` — wire `leagueId` |
| Modify | `src/components/dashboard/LeaderboardSection.tsx` — wire `leagueId` |
| Modify | `tests/mocks/handlers.ts` — add league MSW handlers |
