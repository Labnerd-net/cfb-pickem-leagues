# Plan: Leaderboard Dashboard

## Context

The user dashboard has a "Leaderboard" `DashboardCard` in `UserSection.tsx` that currently renders "Coming soon...". The backend already exposes `GET /api/leaderboard?year=` returning `LeaderboardEntry[]` (ranked by correct picks descending). This plan wires up that card with a real standings table.

Spec answers:
- Season-only for v1 (no week toggle)
- All users shown, scrollable if list is long
- Percentage displayed as integer (e.g. "67%"), null shown as "—"

---

## Files to Create

### 1. `packages/frontend/src/apis/leaderboardRequests.ts`
New API module following the exact pattern of `userRequests.ts`:
```ts
export interface LeaderboardResponse {
  success: boolean;
  data?: LeaderboardEntry[];
  error?: string;
}

export async function getLeaderboard(year: number): Promise<LeaderboardResponse> {
  // client.api.leaderboard.$get({ query: { year: String(year) } })
}
```
Import `LeaderboardEntry` from `@shared/types/cfb-pickem-api.js`.

### 2. `packages/frontend/src/components/user/LeaderboardSection.tsx`
New component to replace the "Coming soon..." content inside the Leaderboard DashboardCard.

State:
- `loading: boolean` — true on mount
- `error: string | null`
- `entries: LeaderboardEntry[]`

On mount: call `getLeaderboard(new Date().getFullYear())`.

Render logic:
- Loading → centered `CircularProgress`
- Error → `Typography` with error message (color: `error.main`)
- Empty array → `Typography` with "No standings yet for this season."
- Data → scrollable MUI `Table` (wrap in `Box` with `maxHeight: 320, overflowY: 'auto'`)

Table columns: **#** | **Name** | **Correct** | **Total** | **%**

Row highlighting: compare `entry.userId` to `user?.userId` from `useAuth()`. Highlighted row gets `sx={{ backgroundColor: 'action.selected' }}`.

Percentage cell: `entry.percentage !== null ? Math.round(entry.percentage) + '%' : '—'`

### 3. `packages/frontend/tests/unit/components/LeaderboardSection.test.tsx`
Tests (use `renderWithProviders`; mock `getLeaderboard` via `vi.mock`):
- Renders ranked table when API returns data
- Highlights the current user's row
- Renders "—" for a user with `percentage: null`
- Shows `CircularProgress` (loading state) while request is in flight
- Shows error message when API call fails
- Shows empty-state message when leaderboard array is empty

### 4. `packages/frontend/tests/unit/apis/leaderboardRequests.test.ts`
Tests for the API function (use MSW pattern from `authRequests.test.ts`):
- Returns `{ success: true, data: [...] }` on 200
- Returns `{ success: false, error: '...' }` on 4xx
- Returns `{ success: false, error: 'Request failed' }` on network error

---

## Files to Modify

### 5. `packages/frontend/src/components/user/UserSection.tsx`
Replace the leaderboard card's `Typography` "Coming soon..." child with `<LeaderboardSection />`. Import the new component.

### 6. `packages/frontend/tests/mocks/handlers.ts`
Add MSW handler for the leaderboard endpoint:
```ts
http.get('http://localhost:3000/api/leaderboard', () =>
  HttpResponse.json({ leaderboard: mockLeaderboardEntries })
)
```

---

## Key Patterns to Reuse

| Pattern | Source file |
|---|---|
| API function structure | `packages/frontend/src/apis/userRequests.ts` |
| Loading / error / empty state | `packages/frontend/src/components/admin/UsersSection.tsx` |
| MUI Table usage | `packages/frontend/src/components/admin/UsersSection.tsx` |
| `useAuth()` for current user | `packages/frontend/src/contexts/auth/AuthContext.tsx` |
| MSW handler pattern | `packages/frontend/tests/mocks/handlers.ts` |
| `renderWithProviders` | `packages/frontend/tests/test-utils.tsx` |

---

## Verification

1. Start backend + frontend (`pnpm dev:backend`, `pnpm dev:frontend`)
2. Log in as a user — leaderboard card should render a table (or empty state if no picks exist yet)
3. Log in as a different user — confirm the highlighted row changes
4. Run frontend tests: `pnpm test:frontend`
5. Type-check: `npx tsc --noEmit -p packages/frontend/tsconfig.app.json`
