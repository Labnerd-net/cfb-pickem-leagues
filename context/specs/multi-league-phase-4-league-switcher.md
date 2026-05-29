# Spec: Multi-League — Phase 4: Frontend League Switcher & Join Flow

## Goal

Give authenticated users the ability to see which leagues they belong to, switch between them, and join a new league via invite code. The active league is stored in React context and injected into all subsequent API calls. No league-scoped game/picks screens yet — those come in Phase 5.

Depends on: Phase 2 backend (league API).

---

## React Context: `LeagueContext`

New file: `src/contexts/LeagueContext.tsx`

```ts
interface LeagueContextValue {
  leagues: LeagueData[];           // all leagues the user belongs to
  activeLeague: LeagueData | null; // currently selected league
  setActiveLeague: (league: LeagueData) => void;
  isLoading: boolean;
  refetchLeagues: () => void;
}
```

Behavior:
- On mount (after auth resolves), fetches `GET /api/leagues`
- Persists `activeLeagueId` to `localStorage` so the selection survives a page refresh
- If stored `activeLeagueId` is still in the fetched list, restores it; otherwise defaults to the first league
- If the user belongs to no leagues, `activeLeague` is `null`
- Wrap `LeagueProvider` inside `AuthProvider` in `App.tsx` so it has access to the auth state

---

## League Switcher Component

New file: `src/components/LeagueSwitcher.tsx`

- Rendered in the app header (or top nav bar) when the user is authenticated and has at least one league
- Shows the active league name
- If user belongs to more than one league, renders a dropdown/select to switch
- If user belongs to exactly one league, renders the name as a static label (no dropdown needed)
- Switching leagues updates `LeagueContext.activeLeague` and persists to localStorage
- Does not trigger a full page reload — downstream components react to context change

---

## No-League State

If `activeLeague === null` (user has no leagues):
- Show a full-page prompt: "You're not in any league yet. Join one with an invite code."
- Render the Join League form inline (no separate route needed)
- Do not render the main app tabs/navigation

---

## Join League Page/Flow

New file: `src/components/JoinLeagueDialog.tsx` (or inline if no-league state)

- Input: invite code (text field, trimmed, case-insensitive)
- Submit calls `POST /api/leagues/join`
- On success: adds the new league to context, switches to it, dismisses the dialog/prompt
- On 404: show "Invalid invite code"
- On 409: show "You're already in this league"

Also add a "Join another league" button somewhere accessible for users who already have a league (e.g., in a league settings menu or user profile).

---

## New API Functions (`src/apis/leagueRequests.ts`)

```ts
getLeagues()                     // GET /api/leagues
getLeague(leagueId)              // GET /api/leagues/:leagueId
joinLeague(inviteCode)           // POST /api/leagues/join
getLeagueMembers(leagueId)       // GET /api/leagues/:leagueId/members
```

All functions use the Hono RPC client pattern (`client.api.leagues...`). Do not use `fetch` directly.

---

## Header Integration

Modify the existing app header/nav to include `<LeagueSwitcher />` between the app title and the user menu. Keep the layout clean — the switcher should not add significant vertical height on desktop.

---

## Routing

No new React Router routes are required for this phase. The join flow is a dialog or inline state, not a separate page.

---

## Acceptance Criteria

- [ ] After login, user's leagues are fetched and stored in context
- [ ] Active league persists across page refresh (localStorage)
- [ ] If user has multiple leagues, dropdown switcher appears in header
- [ ] Switching league updates context; downstream components (in Phase 5) will react
- [ ] If user has no leagues, join prompt is shown instead of the main app
- [ ] Joining a valid invite code adds the league and switches to it immediately
- [ ] Invalid invite code shows inline error, does not navigate away
- [ ] Already-a-member invite shows 409 message inline
- [ ] `pnpm build` passes

---

## Out of Scope for This Phase

- League settings / member management UI (Phase 5)
- Admin-only "Create League" UI (Phase 5)
- Updating picks, results, leaderboard screens to use active league (Phase 5)
- Notifications (Phase 6)
