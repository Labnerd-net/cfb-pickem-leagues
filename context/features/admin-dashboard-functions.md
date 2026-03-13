# Admin Dashboard Functions - Implementation Plan

## Context

Admins need the ability to manage weekly game data directly from the dashboard. Currently, there's no UI for admins to:
- Populate weeks with game data from external sources (NCAA, CFBD, SportsDataverse)
- View games for a specific week
- Select which games should be available for all users to make picks on

The backend API endpoints already exist (`/api/admin/year/:year`, `/api/admin/week`, `/api/admin/getgames`, `/api/admin/setpicks`), but there's no frontend interface to use them. This feature will add admin-only UI components to the dashboard that conditionally appear for users with the admin role.

**User Choice**: Frontend-only implementation with optimistic UI. Will show weeks 1-15 as selectable options without querying which weeks are already populated (users can populate and will see existing games if already done).

## Implementation Approach

### Phase 1: Fix Existing API Request Functions

**File**: `/packages/frontend/src/apis/adminRequests.ts`

**Current Issues**:
- `addWeekstoYear()`: Headers in wrong axios parameter (line 28-30)
- `addGamesToWeek()`: Missing WeekIdData parameter + wrong headers (line 43-48)
- `getAllGames()`: Hardcoded weekData instead of accepting parameter (line 64-68)
- Missing `setPickedGames()` function for `/api/admin/setpicks` endpoint

**Changes**:
1. Fix `addWeekstoYear(year)` - Move headers to config object (third param):
   ```typescript
   const response = await axios.post(
     `${databaseAPI}/${path}/year/${year}`,
     {},  // empty body
     { headers: { Authorization: `Bearer ${token}` } }
   );
   ```

2. Fix `addGamesToWeek()` - Add WeekIdData parameter and fix headers:
   ```typescript
   export async function addGamesToWeek(weekData: WeekIdData): Promise<AddGamesResponse>
   const response = await axios.post(
     `${databaseAPI}/${path}/week`,
     weekData,  // body with WeekIdData
     { headers: { Authorization: `Bearer ${token}` } }
   );
   ```

3. Fix `getAllGames()` - Rename to `getGamesForWeek()` and accept parameter:
   ```typescript
   export async function getGamesForWeek(weekData: WeekIdData): Promise<GetGamesResponse>
   // Remove hardcoded weekData, use parameter instead
   ```

4. Add new `setPickedGames()` function:
   ```typescript
   export interface SetPicksResponse {
     success: boolean;
     data?: { status: string };
     error?: string;
   }

   export async function setPickedGames(pickedData: PickedGamesData): Promise<SetPicksResponse> {
     // Call POST /api/admin/setpicks with pickedData body
   }
   ```

**Reference**: `PickedGamesData` type from `@shared/types/cfb-pickem-api` has structure:
```typescript
{ year: number, week: number, seasonType: SeasonType, games: number[] }
```

### Phase 2: Create Admin UI Components

**Directory**: `/packages/frontend/src/components/dashboard/admin/`

Create four new components in this directory:

#### 2.1 GameCard.tsx (Individual game display with checkbox)
- Displays single game with home/away teams
- Checkbox for selection
- Visual indicator if game is already marked as picked
- Props: `{ game: AdminDbGameData, selected: boolean, onSelect: (selected: boolean) => void }`
- Use Paper, FormControlLabel, Checkbox from MUI
- Style with athletic theme (border color changes when selected)

#### 2.2 GamesList.tsx (Grid of games with bulk actions)
- Renders grid of GameCard components
- "Select All" / "Deselect All" buttons at top
- "Save Picked Games" button at bottom
- Game count display ("X of Y games selected")
- Props: `{ games: AdminDbGameData[], selectedGameIds: number[], onGameSelect, onSaveSelection, loading }`
- Use Box with grid layout: `{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }`
- Gap between cards: 2

#### 2.3 WeekSelector.tsx (Year/week/season controls)
- Year selector (TextField number input, default: current year)
- "Populate Year" button → calls `addWeekstoYear()`
- Season type selector (Select: regular, postseason)
- Week number selector (Select: 1-15 for regular, 1-5 for postseason)
- "Populate Week" button → calls `addGamesToWeek()`
- "Load Games" button → calls `getGamesForWeek()`
- Props: `{ selectedYear, onYearChange, selectedWeek, onWeekSelect, onPopulateYear, onPopulateWeek, onLoadGames, loading }`
- Use Stack for vertical spacing, Grid for responsive layout
- Loading states with CircularProgress

#### 2.4 AdminSection.tsx (Main container and state orchestrator)
- Container wrapping WeekSelector and GamesList
- Manages all state:
  - `selectedYear: number` (default: `new Date().getFullYear()`)
  - `selectedWeek: WeekIdData | null`
  - `games: AdminDbGameData[]`
  - `selectedGameIds: number[]`
  - `loading: boolean`
  - `error: string | null`
  - `successMessage: string | null`
- API integration functions:
  - `handlePopulateYear()` → calls `addWeekstoYear(selectedYear)`
  - `handlePopulateWeek()` → calls `addGamesToWeek(selectedWeek)`
  - `handleLoadGames()` → calls `getGamesForWeek(selectedWeek)`, populates `games` state
  - `handleSavePickedGames()` → calls `setPickedGames({ ...selectedWeek, games: selectedGameIds })`
  - `handleGameSelection()` → toggles game ID in selectedGameIds array
- Error handling with try/catch, display errors in Alert component
- Success messages in Alert component
- Use DashboardCard with `gridColumn: { xs: '1', md: 'span 2' }` for full width
- Icon: AdminPanelSettingsIcon, accentColor: 'secondary'

**Reuse Existing Components**:
- DashboardCard (from `/packages/frontend/src/components/dashboard/DashboardCard.tsx`)
- Material-UI components: Box, Stack, Grid, Typography, Button, Select, TextField, Checkbox, Alert, CircularProgress, Paper, FormControlLabel
- Athletic theme fonts: Bebas Neue (headers), Work Sans (body)

### Phase 3: Integrate Admin Section into Dashboard

**File**: `/packages/frontend/src/pages/Dashboard.tsx`

**Changes**:
1. Import AdminSection component
2. Import useAuth hook (already imported)
3. Check if user has admin role: `const isAdmin = user?.roles.includes('admin') ?? false;`
4. Conditionally render AdminSection after existing cards:
   ```tsx
   {isAdmin && <AdminSection />}
   ```
   
**User Input**: Evaluate if we should have the admin section under a different tab for admin users.  For example one tab for all users that contains games to pick winners.  For admins, add another tab to isolate listing all games and picking games for weekly challenge.  Unless you see a better user interface option.


**Grid Layout**: Existing grid already supports this - AdminSection's `gridColumn` prop will make it span full width

### Phase 4: Type System (No Changes Needed)

All required types already exist in `@shared/types/cfb-pickem-api`:
- `WeekIdData` - { year, week, seasonType }
- `AdminWeekData` - Week metadata
- `AdminDbGameData` - Complete game data
- `PickedGamesData` - { year, week, seasonType, games: number[] }
- `SeasonType` - 'regular' | 'postseason' | etc.

## Implementation Sequence

1. **Fix API functions** (adminRequests.ts) - Test each function with console logs
2. **Build GameCard** - Simple component, good starting point
3. **Build GamesList** - Compose GameCards into grid
4. **Build WeekSelector** - Form controls for week selection
5. **Build AdminSection** - State management and API integration
6. **Integrate into Dashboard** - Add conditional rendering
7. **Test full workflow** - End-to-end admin flow

## User Workflow (Happy Path)

1. Admin logs in → Dashboard loads
2. Admin sees "Admin Controls" section at bottom (non-admins don't see this)
3. Admin enters year (e.g., 2025) and clicks "Populate Year"
   - Success message: "All weeks populated for 2025"
4. Admin selects season type (regular) and week number (1)
5. Admin clicks "Populate Week"
   - Success message: "Games populated for Week 1"
6. Admin clicks "Load Games"
   - Games appear in grid below with checkboxes
7. Admin selects desired games (checks boxes)
8. Admin clicks "Save Picked Games"
   - Success message: "12 games marked as available for picks"
   - Selected games now have `picked: true` in database

## Edge Cases & Error Handling

- **Year already populated**: Backend handles gracefully, returns success
- **Week already populated**: Shows existing games when loaded
- **Network errors**: Display in Alert with retry option
- **Invalid selections**: Validate week number ranges (1-15 regular, 1-5 postseason)
- **No games selected**: Warn user before saving (at least 1 game recommended)
- **Loading states**: Show CircularProgress during all API calls
- **Backend errors**: Display error.message from API response

## Critical Files

1. `/packages/frontend/src/apis/adminRequests.ts` - Fix broken API functions
2. `/packages/frontend/src/components/dashboard/admin/AdminSection.tsx` - Main orchestrator (NEW)
3. `/packages/frontend/src/components/dashboard/admin/WeekSelector.tsx` - Week controls (NEW)
4. `/packages/frontend/src/components/dashboard/admin/GamesList.tsx` - Game grid (NEW)
5. `/packages/frontend/src/components/dashboard/admin/GameCard.tsx` - Individual game (NEW)
6. `/packages/frontend/src/pages/Dashboard.tsx` - Integration point

## Verification & Testing

### Manual Testing Steps:
1. **Role Check**:
   - Login as non-admin user → Admin section should NOT appear
   - Login as admin user → Admin section SHOULD appear at bottom of dashboard

2. **Year Population**:
   - Select year 2025, click "Populate Year"
   - Check console for success response
   - Verify backend created weeks in database (can check with Drizzle Studio)

3. **Week Population**:
   - Select "Regular Season" and "Week 1"
   - Click "Populate Week"
   - Check console for success response
   - Verify games created in database

4. **Load Games**:
   - Click "Load Games" button
   - Games should appear in grid below
   - Each game should have checkbox

5. **Select Games**:
   - Click individual game checkboxes
   - Try "Select All" and "Deselect All" buttons
   - Verify selected count updates

6. **Save Picked Games**:
   - Select 5-10 games
   - Click "Save Picked Games"
   - Check success message
   - Reload page and load same week again
   - Previously selected games should show as already picked

7. **Error Handling**:
   - Test with invalid year (e.g., 1900)
   - Test with network disconnected
   - Verify error messages display in Alert component

8. **Responsive Design**:
   - Test on mobile (single column games)
   - Test on tablet (two column games)
   - Test on desktop (three column games)

### Backend Endpoints to Verify:
- `POST /api/admin/year/:year` - Populates weeks
- `POST /api/admin/week` - Populates games (body: WeekIdData)
- `POST /api/admin/getgames` - Gets games (body: WeekIdData)
- `POST /api/admin/setpicks` - Sets picked games (body: PickedGamesData)

All endpoints require JWT token in Authorization header and admin role.

### Database Verification:
Use Drizzle Studio (`pnpm studio` in packages/backend) to verify:
- `admin.adminWeeks` table has populated weeks
- `admin.adminGames` table has populated games
- Games have `picked: true` after saving selection

## Out of Scope (Future Enhancements)

- Showing which weeks are already populated (requires new backend endpoint)
- Batch operations across multiple weeks
- Game filtering/search within a week
- Draft/publish workflow for pick games
- Audit log of admin actions
- Analytics on game selection patterns
- Scheduled automatic population
