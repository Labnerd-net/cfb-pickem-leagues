# Implementation Plan: Weekly Game Picks Selection

## Context

This feature enables users to view admin-curated games and make their picks directly from the dashboard. Currently, the user dashboard shows placeholder "Coming soon..." messages in three cards: "Your Picks", "Leaderboard", and "This Week's Games". This implementation will replace the "This Week's Games" card with a functional game picking interface.

**Why this change is needed:**
- Core user engagement feature - allows users to make weekly picks
- Admin-curated games already exist in the system (via admin section)
- Backend API endpoints already exist and are functional
- Users need a way to submit picks and track their selections

**Current state:**
- Backend has complete API: `GET /user/games` (fetch pickable games), `GET /user/picks` (fetch user picks), `POST /user/picks` (save picks)
- Database schema supports picks via `user.games` table with `teamChosen` field
- Frontend has placeholder UI that needs implementation

## Implementation Overview

**Total files to create:** 5 new components + 1 utility
**Files to modify:** 2 (UserSection.tsx, userRequests.ts)
**Estimated complexity:** Medium

## Critical Files

### 1. Fix Broken API Function (CRITICAL - Must Fix First)

**File:** `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/apis/userRequests.ts`

**Problem:** Lines 94-112 - `postUserPicks()` doesn't accept parameters and has incorrect axios syntax (headers in body position)

**Fix:**
```typescript
export async function postUserPicks(picks: AllUserGamePicksRequest): Promise<PicksResponse> {
  try {
    const token = localStorage.getItem('jwt');
    const response = await axios.post(
      `${databaseAPI}/${path}/picks`,
      picks,  // Request body with picks data
      { headers: { Authorization: `Bearer ${token}` } }  // Config object with headers
    );
    if (response.data.ok) {
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      return { success: false, error: error.response.data.error };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}
```

**Import needed:** Add `AllUserGamePicksRequest` to imports from `@shared/types/cfb-pickem-api.js`

### 2. Week Calculation Utility (NEW)

**File:** `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/utils/weekCalculation.ts`

**Purpose:** Calculate current week based on date ranges, handle off-season

**Implementation:**
```typescript
import type { AdminDbWeekData } from '@shared/types/cfb-pickem-api.js';

export interface CurrentWeek {
  year: number;
  week: number;
}

export function getCurrentWeek(weeks: AdminDbWeekData[]): CurrentWeek {
  const now = new Date();

  // Find week where current date is between weekStart and weekEnd
  const currentWeek = weeks.find(week => {
    const start = new Date(week.weekStart);
    const end = new Date(week.weekEnd);
    return now >= start && now <= end;
  });

  if (currentWeek) {
    return { year: currentWeek.year, week: currentWeek.weekNumber };
  }

  // Off-season: Default to first week of next season
  // Sort by year descending, then find week 1
  const sortedByYear = [...weeks].sort((a, b) => b.year - a.year);
  const latestYear = sortedByYear[0]?.year || now.getFullYear();
  const nextSeasonWeek1 = weeks.find(w => w.year === latestYear && w.weekNumber === 1);

  if (nextSeasonWeek1) {
    return { year: nextSeasonWeek1.year, week: nextSeasonWeek1.weekNumber };
  }

  // Fallback: use current year, week 1
  return { year: now.getFullYear(), week: 1 };
}
```

### 3. User Picks Game Card (NEW)

**File:** `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/user/UserPicksGameCard.tsx`

**Purpose:** Display single game with radio button selection for teams

**Pattern to follow:** Similar to `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/admin/GameCard.tsx` but with radio buttons instead of checkbox

**Key features:**
- Radio button group with two options (away team, home team)
- Shows team names prominently
- Visual indicator if pick was previously saved (subtle styling)
- Disabled state for games that have started (future enhancement)
- Typography: Bebas Neue for team names, Work Sans for details

**Props:**
```typescript
interface UserPicksGameCardProps {
  game: AdminDbGameData;
  selectedTeam?: 'home_team' | 'away_team';
  onPickChange: (gameId: number, pick: 'home_team' | 'away_team') => void;
  hasSavedPick?: boolean;
}
```

### 4. User Picks Games List (NEW)

**File:** `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/user/UserPicksGamesList.tsx`

**Purpose:** Render grid of game cards + submit button

**Pattern to follow:** `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/admin/GamesList.tsx`

**Layout:**
- Grid: `gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }`
- Submit button at bottom (primary color, full width on mobile)
- Show pick count: "X of Y games picked"
- Loading spinner in button during submission
- Disabled when no picks made

**Props:**
```typescript
interface UserPicksGamesListProps {
  games: AdminDbGameData[];
  picks: Map<number, 'home_team' | 'away_team'>;
  savedPicks: Set<number>; // gameIds that have saved picks
  onPickChange: (gameId: number, pick: 'home_team' | 'away_team') => void;
  onSubmit: () => void;
  loading: boolean;
}
```

### 5. Week Selector (NEW)

**File:** `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/user/UserWeekSelector.tsx`

**Purpose:** Simple week navigation controls

**Pattern to follow:** Simplified version of `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/admin/WeekSelector.tsx`

**Design options (choose one):**
- Option A: Dropdown with year + week selection (similar to admin)
- Option B: Previous/Next buttons with current week display
- Recommended: Option A for consistency - Yes, choose option A

**Props:**
```typescript
interface UserWeekSelectorProps {
  selectedYear: number;
  selectedWeek: number;
  weeks: AdminDbWeekData[];
  onYearChange: (year: number) => void;
  onWeekChange: (week: number) => void;
  loading: boolean;
}
```

### 6. Main Container Component (NEW)

**File:** `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/user/UserPicksSection.tsx`

**Purpose:** Main orchestrator - state management, API calls, business logic

**State:**
```typescript
const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
const [selectedWeek, setSelectedWeek] = useState<number>(1);
const [weeks, setWeeks] = useState<AdminDbWeekData[]>([]);
const [availableGames, setAvailableGames] = useState<AdminDbGameData[]>([]);
const [userPicks, setUserPicks] = useState<Map<number, 'home_team' | 'away_team'>>(new Map());
const [savedPickIds, setSavedPickIds] = useState<Set<number>>(new Set());
const [loading, setLoading] = useState<boolean>(false);
const [submitting, setSubmitting] = useState<boolean>(false);
const [snackbarMessage, setSnackbarMessage] = useState<string>('');
const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
```

**useEffect Hooks:**

1. **Initial Load** (mount only):
```typescript
useEffect(() => {
  // Fetch weeks for current year and next year (to handle off-season)
  // Calculate current week using getCurrentWeek()
  // Set selectedYear and selectedWeek
  // Trigger game fetch
}, []);
```

2. **Year Change**:
```typescript
useEffect(() => {
  if (selectedYear === 0) return; // Skip initial render
  // Fetch weeks for new year
  // Reset to week 1
}, [selectedYear]);
```

3. **Week Change**:
```typescript
useEffect(() => {
  if (selectedWeek === 0) return; // Skip initial render
  // Fetch available games
  // Fetch user's existing picks
  // Merge into state
}, [selectedYear, selectedWeek]);
```

**Key Functions:**

```typescript
async function loadWeeks(year: number): Promise<void>
async function loadGamesAndPicks(): Promise<void>
function handlePickChange(gameId: number, pick: 'home_team' | 'away_team'): void
async function handleSubmit(): Promise<void>
```

**Submit Logic:**
```typescript
// Transform Map to AllUserGamePicksRequest
const picksArray = Array.from(userPicks.entries()).map(([gameId, pick]) => ({
  game: gameId,
  pick,
}));

const request: AllUserGamePicksRequest = {
  year: selectedYear,
  week: selectedWeek,
  games: picksArray,
};

const result = await postUserPicks(request);
```

**Error Handling:**
- No games available → Show "No games for this week" message
- Network error → Snackbar with error message
- Empty picks → Disable submit button

### 7. Integration Point (MODIFY)

**File:** `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/user/UserSection.tsx`

**Change:** Lines 48-63 - Replace the "This Week's Games" DashboardCard content

**Before:**
```typescript
<DashboardCard ...>
  <Typography sx={{ ... }}>
    Coming soon...
  </Typography>
</DashboardCard>
```

**After:**
```typescript
<DashboardCard ...>
  <UserPicksSection />
</DashboardCard>
```

**Import:** `import UserPicksSection from './UserPicksSection';`

## Implementation Sequence

### Phase 1: Foundation (15 min)
1. Create `weekCalculation.ts` utility
2. Fix `postUserPicks()` in `userRequests.ts`

### Phase 2: UI Components (30 min)
3. Create `UserPicksGameCard.tsx` (radio buttons + styling)
4. Create `UserPicksGamesList.tsx` (grid + submit button)
5. Create `UserWeekSelector.tsx` (week navigation)

### Phase 3: Integration (30 min)
6. Create `UserPicksSection.tsx` (state + API + logic)
7. Update `UserSection.tsx` to render UserPicksSection

### Phase 4: Testing & Polish (20 min)
8. Test full flow: load → pick → submit → verify
9. Test edge cases: no games, network errors, partial picks
10. Add snackbar notifications and loading states

**Total estimated time:** ~90 minutes

## API Integration Details

### Endpoints Used

1. **GET /user/games?year=X&week=Y**
   - Returns: `{ ok: true, data: { pickedGames: AdminDbGameData[] } }`
   - Use: `getPickedGames(weekData)`

2. **GET /user/picks?year=X&week=Y**
   - Returns: `{ ok: true, data: { picks: UserDbGameData[] } }`
   - Use: `getUserPicks(weekData)`

3. **POST /user/picks**
   - Request body: `AllUserGamePicksRequest`
   - Returns: `{ ok: true, data: { status: 'updated picked games' } }`
   - Use: `postUserPicks(picksData)`

### Response Handling Pattern

```typescript
const result = await getPickedGames({ year: selectedYear, week: selectedWeek });
if (result.success && result.data) {
  setAvailableGames(result.data.pickedGames);
} else {
  setSnackbarMessage(result.error || 'Failed to load games');
  setSnackbarSeverity('error');
  setSnackbarOpen(true);
}
```

## Testing Strategy

### Unit Tests

**File:** `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/tests/unit/utils/weekCalculation.test.ts`

Test cases:
- Current date within a week range → returns that week
- Current date in off-season → returns first week of next season
- Empty weeks array → returns fallback (current year, week 1)
- Multiple years available → selects correct year

### Integration Tests

**File:** `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/tests/integration/UserPicksSection.test.tsx`

Test cases:
- Initial load fetches weeks and current week games
- Week selection triggers new game fetch
- Pick selection updates local state
- Submit sends correct data to API
- Success shows snackbar notification
- Error shows error message
- No games available shows empty state

### Manual Testing Checklist

1. ✅ Dashboard loads with current week games
2. ✅ Can select different year/week
3. ✅ Games display with team names
4. ✅ Can select team via radio button
5. ✅ Can change selection before submitting
6. ✅ Submit button disabled when no picks made
7. ✅ Submit shows loading state
8. ✅ Success snackbar appears after submit
9. ✅ Picks persist after page refresh
10. ✅ No games week shows friendly message
11. ✅ Network error shows error message
12. ✅ Partial picks can be submitted

## Verification Steps

After implementation, verify the feature works end-to-end:

1. **Login as regular user**
   ```bash
   cd packages/frontend
   pnpm dev
   # Navigate to http://localhost:5173/login
   ```

2. **Navigate to Dashboard**
   - Should see "This Week's Games" card with real content
   - Should see current week's games (or next season if off-season)

3. **Make picks**
   - Select teams via radio buttons
   - Click "Submit All Picks" button
   - Verify success message appears

4. **Verify persistence**
   - Refresh page
   - Navigate to same week
   - Confirm picks are still selected

5. **Test edge cases**
   - Navigate to week with no games → see "No games" message
   - Navigate to future week → works without errors
   - Disconnect network → see error message

6. **Run tests**
   ```bash
   cd packages/frontend
   pnpm test
   ```

## Design Decisions

### Why Map for picks instead of array?
- O(1) lookup for checking if game has pick
- Easy to update individual picks
- Natural key-value relationship (gameId → pick)

### Why separate savedPickIds Set?
- Track which picks were previously saved (for visual feedback)
- Distinguish between "just picked" and "saved to database"
- Enables future "unsaved changes" warning

### Why AllUserGamePicksRequest instead of AllUserGamePicks?
- Frontend doesn't need to determine seasonType
- Backend doesn't use seasonType from request body
- Simpler type, less chance of errors
- Backend type annotation is misleading but works

### Why not auto-save on pick change?
- User explicitly requested "one button to submit all picks"
- Allows users to review/change before committing
- Simpler error handling (batch operation)
- Clearer user intent

### Why fetch weeks for current + next year?
- Handles off-season gracefully (need next year's weeks)
- Minimal overhead (weeks are lightweight data)
- Avoids extra fetch when crossing year boundary
- User can navigate between years without new requests

## Accessibility Notes

- Use `<RadioGroup>` from Material-UI for proper ARIA labels
- Ensure keyboard navigation works (Tab through cards, Arrow keys within radio group)
- Add clear focus indicators (Material-UI provides by default)
- Screen reader support: announce game info and selected team
- Loading states announce to screen readers via `aria-live`

## Future Enhancements (Out of Scope)

These are mentioned in the spec but deferred:
- Deadline enforcement (disable picks after game start)
- Pick history and statistics dashboard
- Real-time score updates during games
- Comparison with other users (leaderboard)
- Pick confidence/point allocation system
- Push notifications for game start times

## Notes

- Backend API is complete and functional ✓
- Database schema supports all requirements ✓
- Admin section already curates games ✓
- User authentication already works ✓
- Material-UI components available ✓
- Existing patterns to follow in AdminSection ✓

This is a greenfield implementation with clear requirements, existing backend support, and good code patterns to follow.
