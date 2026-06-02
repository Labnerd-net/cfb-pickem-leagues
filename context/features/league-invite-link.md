# Plan: League Invite Link with Confirmation Screen

## Context

League admins currently share an invite code that recipients must manually enter in a dialog. This feature adds a direct `/join/:inviteCode` URL that shows a confirmation screen with the league name. Unauthenticated users are redirected to login/register with the invite URL preserved, then returned to confirm and join. No backend data model changes are needed — the invite code already exists on each league.

---

## Implementation Steps

### 1. Backend — Public endpoint: `GET /leagues/invite/:inviteCode`

Add to `packages/backend/src/routes/leagues.ts`, **before** `authMiddleware` on this route (no auth required):

```
GET /leagues/invite/:inviteCode → { leagueName: string }
```

- Uses existing `getLeagueByInviteCode(inviteCode)` from `dbLeagueFunctions.ts`
- Returns 404 if not found, otherwise `{ leagueName: league.name }`
- Add `inviteCodeParamValidator` to `zValidate.ts` (simple string param schema) or inline with `zValidator`

Add a corresponding `getLeagueByInviteCodePublic(inviteCode)` function to `packages/frontend/src/apis/leagueRequests.ts` that calls `GET /api/leagues/invite/:inviteCode` — no auth needed on the client side either.

---

### 2. Frontend — Auth redirect support

Update `packages/frontend/src/pages/LoginForm.tsx` and `RegistrationForm.tsx`:

- Read `?redirect=` query param via `useSearchParams()`
- After successful auth (`login()` resolves), navigate to the redirect URL if present, otherwise `/dashboard`

Pattern (same in both files):
```
const [searchParams] = useSearchParams();
const redirectTo = searchParams.get('redirect') ?? '/dashboard';
// after login():
navigate(redirectTo, { replace: true });
```

---

### 3. Frontend — `/join/:inviteCode` route

Add to `packages/frontend/src/App.tsx`:

```
<Route path="join/:inviteCode" element={<JoinLeagueConfirm />} />
```

Place this route **outside** any `PrivateRoute` wrapper and outside the Navbar wrapper (if one exists). Check App.tsx structure — if Navbar wraps all routes, extract just this route or conditionally suppress the Navbar on `/join/*`.

---

### 4. Frontend — `JoinLeagueConfirm.tsx` (new page)

`packages/frontend/src/pages/JoinLeagueConfirm.tsx` — standalone full-page layout (no Navbar).

**States:**
- **Loading**: fetching league name from public endpoint
- **Invalid code**: error card ("This invite link is no longer valid")
- **Unauthenticated**: show league name + "Log in to join" / "Create account" buttons — both link to `/login?redirect=/join/:inviteCode` and `/register?redirect=/join/:inviteCode`
- **Authenticated, not a member**: show league name + "Join League" button + "Decline" (`navigate(-1)`)
- **Authenticated, already a member**: show "You're already a member of [name]" + link to dashboard
- **Joining in progress**: loading spinner on join button
- **Join error**: inline error message

**Flow:**
1. On mount: call `getLeagueByInviteCodePublic(inviteCode)` to get league name (no auth)
2. Read `user` from `useAuth()` to determine auth state
3. If logged in and not already a member: "Join League" calls `joinLeague(inviteCode)` from `leagueRequests.ts`, then on success calls `refetchLeagues()` + `setActiveLeague(newLeague)` + `navigate('/dashboard', { replace: true })`
4. 409 response → already a member state
5. Layout: centered card, ~480px max-width, league name prominent, minimal chrome

---

### 5. Frontend — Copy invite link in `LeagueSettingsSection`

In `packages/frontend/src/components/LeagueSettingsSection.tsx`, add a "Copy invite link" button alongside the existing "Copy invite code" button:

```
navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`)
```

Reuse the existing `copied` state pattern (tooltip "Copied!" for 2s) — add a second `copiedLink` state for the link button.

---

## Files Modified

- `packages/backend/src/routes/leagues.ts` — add `GET /leagues/invite/:inviteCode` (public)
- `packages/frontend/src/apis/leagueRequests.ts` — add `getLeagueByInviteCodePublic`
- `packages/frontend/src/App.tsx` — add `/join/:inviteCode` route outside PrivateRoute
- `packages/frontend/src/pages/JoinLeagueConfirm.tsx` — new standalone page
- `packages/frontend/src/pages/LoginForm.tsx` — support `?redirect=` param
- `packages/frontend/src/pages/RegistrationForm.tsx` — support `?redirect=` param
- `packages/frontend/src/components/LeagueSettingsSection.tsx` — add "Copy invite link" button

---

## Verification

1. `npx tsc --noEmit` on both packages — no type errors
2. Backend: `GET /api/leagues/invite/VALID_CODE` returns `{ leagueName }` without a cookie; invalid code returns 404
3. Frontend (manual):
   - Logged-out user visits `/join/CODE` → sees unauthenticated state with league name → clicks "Log in to join" → logs in → lands back on confirmation → clicks "Join League" → redirected to dashboard in that league
   - Logged-in user visits `/join/CODE` → sees confirmation immediately → joins → dashboard
   - Already-member visits link → sees "already a member" message
   - Invalid code → error card
   - League Settings "Copy invite link" copies correct URL
