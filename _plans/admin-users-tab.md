# Plan: Admin Users Tab

## Context
The Dashboard already has a 2-tab system for admins (My Dashboard, Admin Controls). This adds a third tab — Users — visible only to admins, that lists all registered users with their display name, email, and roles. The backend endpoint skeleton already exists but uses POST incorrectly; the DB function already works. This is primarily a frontend task plus one backend method fix.

---

## Changes Required

### 1. Fix backend route method — `packages/backend/src/routes/admin.ts` (line 23)
Change `admin.post('/users', ...)` → `admin.get('/users', ...)`.
No other changes to the route body needed; `returnUsers()` already returns `UserDbData[]` and the route already casts to `ProfileData[]` before responding.

### 2. Add frontend API function — `packages/frontend/src/apis/adminRequests.ts`
Add a `GetUsersResponse` interface and a `getUsers()` function following the exact same pattern as `getWeeksForYear()`:
- `GET /api/admin/users`
- JWT from `localStorage.getItem('jwt')` in `Authorization: Bearer` header
- Returns `{ success: true, data: ProfileData[] }` or `{ success: false, error: string }`
- Import `ProfileData` from `@shared/types/cfb-pickem-api`

### 3. Create new component — `packages/frontend/src/components/admin/UsersSection.tsx`
New component following the `AdminSection` pattern:
- `useState` for `users: ProfileData[]`, `loading: boolean`, `errorMessage: string | null`
- `useEffect` on mount to call `getUsers()` and populate state
- Render inside a `DashboardCard` (same as AdminSection uses)
- Display users in a MUI `Table` with columns: Display Name, Email, Roles
- Roles rendered as comma-separated strings (e.g. "admin, user"), not raw array
- Show MUI `CircularProgress` while loading
- Show `Alert` severity="error" on failure
- Show a plain `Typography` empty-state message if the list is empty (unlikely but handled)
- No edit/delete actions — read-only

### 4. Update Dashboard — `packages/frontend/src/pages/Dashboard.tsx`
- Import `PeopleIcon` from `@mui/icons-material/People` for the new tab
- Import `UsersSection`
- Add a third `<Tab>` with label "Users" and the People icon
- Change the content switch from `currentTab === 0 ? <UserSection /> : <AdminSection />` to a 3-way conditional:
  - `currentTab === 0` → `<UserSection />`
  - `currentTab === 1` → `<AdminSection />`
  - `currentTab === 2` → `<UsersSection />`

---

## Files to Modify / Create

| File | Action |
|------|--------|
| `packages/backend/src/routes/admin.ts` | Change `post` → `get` on `/users` |
| `packages/frontend/src/apis/adminRequests.ts` | Add `GetUsersResponse` interface + `getUsers()` |
| `packages/frontend/src/components/admin/UsersSection.tsx` | Create new component |
| `packages/frontend/src/pages/Dashboard.tsx` | Add third tab + render UsersSection |

---

## Reusable Patterns / Imports to Follow
- `DashboardCard` from `../dashboard/DashboardCard` — wraps all admin sections
- `ok()` / `err()` from `src/utils/response.ts` — already used in route
- `ProfileData` from `@shared/types/cfb-pickem-api` — already imported in admin route
- `getWeeksForYear()` in `adminRequests.ts` — exact pattern to follow for `getUsers()`
- `AdminSection.tsx` — component structure template (loading state, error Snackbar, DashboardCard)

---

## Tests

### Frontend — `packages/frontend/tests/unit/apis/adminRequests.test.ts` (new file)
Using existing MSW server from `tests/mocks/server.ts` and `handlers.ts`:
- Add handler for `GET /api/admin/users` returning mock `ProfileData[]`
- Test: `getUsers()` returns `{ success: true, data: [...] }` on 200
- Test: `getUsers()` returns `{ success: false, error: '...' }` when backend returns `ok: false`

### Backend — `packages/backend/tests/routes/adminUsers.test.ts` (new file)
Using the existing Hono app with PGlite test DB and seeded test data:
- Test: `GET /api/admin/users` with valid admin JWT → 200 + `allUserProfiles` array
- Test: `GET /api/admin/users` with non-admin JWT → 403
- Test: `GET /api/admin/users` with no token → 401

---

## Verification
1. Start backend (`pnpm dev:backend`) and frontend (`pnpm dev:frontend`)
2. Log in as admin → Dashboard should show 3 tabs
3. Click "Users" tab → list of all users appears with display name, email, roles
4. Log in as regular user → no tabs, no Users section visible
5. Run `pnpm test` — all new tests pass
