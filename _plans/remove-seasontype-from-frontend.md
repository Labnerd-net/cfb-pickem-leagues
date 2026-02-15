# Implementation Plan: Remove SeasonType from Frontend

## Context

The frontend currently hardcodes `seasonType: 'regular'` when making API calls to load games and weeks. This creates a limitation where postseason games cannot be accessed through the UI. The `WeekQuery` interface requires seasonType to be passed from the frontend, but this is unnecessary since:

1. The `admin.weeks` table already stores seasonType (populated from CFBD calendar API)
2. Database queries don't actually filter by seasonType - they only use (year, weekNumber)
3. The only place seasonType is truly needed is when calling external APIs (CFBD) to fetch game data

This refactoring removes seasonType from frontend requests and derives it from the weeks table on the backend when needed.

## Implementation Strategy

Create new lightweight types (`WeekIdentifier`, `PickedGamesRequest`) that don't include seasonType. The backend will look up seasonType from the database when it needs to call external APIs. All response types keep seasonType for display purposes.

## Critical Files to Modify

1. `/home/bladner/Documents/programming/cfb-pickem/packages/shared/types/cfb-pickem-api.ts`
2. `/home/bladner/Documents/programming/cfb-pickem/packages/backend/src/db/dbAdminFunctions.ts`
3. `/home/bladner/Documents/programming/cfb-pickem/packages/backend/src/db/dbUserFunctions.ts`
4. `/home/bladner/Documents/programming/cfb-pickem/packages/backend/src/routes/admin.ts`
5. `/home/bladner/Documents/programming/cfb-pickem/packages/backend/src/routes/user.ts`
6. `/home/bladner/Documents/programming/cfb-pickem/packages/backend/src/utils/zValidate.ts`
7. `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/admin/AdminSection.tsx`
8. `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/apis/adminRequests.ts`
9. `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/apis/userRequests.ts`
10. `/home/bladner/Documents/programming/cfb-pickem/packages/backend/tests/unit/db/dbAdminFunctions.test.ts`

## Detailed Implementation Steps

### Step 1: Add New Types (Shared)

**File:** `packages/shared/types/cfb-pickem-api.ts`

Add new interfaces that don't include seasonType:

```typescript
export interface WeekIdentifier {
  year: number;
  week: number;
}

export interface PickedGamesRequest extends WeekIdentifier {
  games: number[];
}

export interface AllUserGamePicksRequest extends WeekIdentifier {
  games: UserGamePicks[];
}
```

Keep existing `WeekQuery`, `PickedGamesData`, and `AllUserGamePicks` for internal backend use (API adapters still need seasonType to call CFBD).

### Step 2: Add Backend Helper Functions

**File:** `packages/backend/src/db/dbAdminFunctions.ts`

Add two new helper functions:

```typescript
export async function getSeasonTypeForWeek(
  year: number,
  week: number
): Promise<SeasonType | null> {
  const weekData = await db
    .select({ seasonType: adminWeeks.seasonType })
    .from(adminWeeks)
    .where(and(eq(adminWeeks.year, year), eq(adminWeeks.weekNumber, week)))
    .limit(1);

  return weekData.length > 0 ? weekData[0].seasonType : null;
}

export async function enrichWeekIdentifier(
  identifier: WeekIdentifier
): Promise<WeekQuery> {
  const seasonType = await getSeasonTypeForWeek(identifier.year, identifier.week);

  if (!seasonType) {
    throw new Error(
      `Week ${identifier.week} of year ${identifier.year} not found in database. ` +
      `Please ensure weeks are loaded before fetching games.`
    );
  }

  return {
    year: identifier.year,
    week: identifier.week,
    seasonType,
  };
}
```

Update existing function signatures to accept `WeekIdentifier` instead of `WeekQuery`:
- `returnWeekByQuery(identifier: WeekIdentifier)`
- `returnGamesForWeek(identifier: WeekIdentifier)`
- `returnPickedGames(identifier: WeekIdentifier)`

(Keep function bodies unchanged - they already don't use seasonType in WHERE clauses)

### Step 3: Update User Database Functions

**File:** `packages/backend/src/db/dbUserFunctions.ts`

Update function signature:
- `returnUserGames(identifier: WeekIdentifier, userId: string)`

(Function body already doesn't use seasonType in WHERE clause)

### Step 4: Add New Validation Schemas

**File:** `packages/backend/src/utils/zValidate.ts`

Add new schemas for frontend requests:

```typescript
const weekIdentifierSchema = z.object({
  year: z.number(),
  week: z.number(),
});

const pickedGameRequestSchema = z.object({
  year: z.number(),
  week: z.number(),
  games: z.number().array(),
});
```

Keep existing `weekQuerySchema` for internal use.

### Step 5: Update Admin Routes

**File:** `packages/backend/src/routes/admin.ts`

**Route: POST /week** (Add games to week)
- Accept `WeekIdentifier` from JSON body
- Call `enrichWeekIdentifier()` to get `WeekQuery` with seasonType
- Pass `WeekQuery` to `getGameData()` for CFBD API call

**Route: GET /getgames** (Get games for week)
- Accept year and week from query params as `WeekIdentifier`
- Auto-load weeks if they don't exist (call `getWeekData(year)`)
- Query database for games using `WeekIdentifier`
- If no games found, call `enrichWeekIdentifier()` then fetch from CFBD
- Return games

**Route: POST /setpicks** (Set picked games)
- Accept `PickedGamesRequest` from JSON body
- No seasonType lookup needed - just update picked flags

### Step 6: Update User Routes

**File:** `packages/backend/src/routes/user.ts`

**Route: GET /picks** (Get user picks)
- Accept year and week from query params as `WeekIdentifier`
- Call `returnUserGames(identifier, userId)`

**Route: GET /games** (Get picked games)
- Accept year and week from query params as `WeekIdentifier`
- Call `returnPickedGames(identifier)`

### Step 7: Update Frontend API Functions

**File:** `packages/frontend/src/apis/adminRequests.ts`

Update all functions to use new types:
- `addGamesToWeek(weekData: WeekIdentifier)` - remove seasonType from body
- `getGamesForWeek(weekData: WeekIdentifier)` - remove seasonType from query params
- `setPickedGames(pickedData: PickedGamesRequest)` - remove seasonType from body

**File:** `packages/frontend/src/apis/userRequests.ts`

Update functions:
- `getUserPicks(weekData: WeekIdentifier)` - remove seasonType from params
- `getPickedGames(weekData: WeekIdentifier)` - remove seasonType from params

### Step 8: Update Frontend Component

**File:** `packages/frontend/src/components/admin/AdminSection.tsx`

Changes:
1. Import `WeekIdentifier` instead of `WeekQuery`
2. Remove the `getWeekData()` helper function (lines 28-33)
3. Replace both hardcoded seasonType instances (lines 32, 151) with:
   ```typescript
   const weekData: WeekIdentifier = {
     year: selectedYear,
     week: selectedWeek,
   };
   ```

### Step 9: Update Tests

**File:** `packages/backend/tests/unit/db/dbAdminFunctions.test.ts`

- Update imports to use `WeekIdentifier`
- Remove `seasonType: 'regular'` from all test WeekQuery objects
- Add new tests for `getSeasonTypeForWeek()` and `enrichWeekIdentifier()`

Test cases to add:
```typescript
describe('getSeasonTypeForWeek', () => {
  it('should return seasonType for existing week', async () => {
    const seasonType = await getSeasonTypeForWeek(2024, 1);
    expect(seasonType).toBe('regular');
  });

  it('should return null for non-existent week', async () => {
    const seasonType = await getSeasonTypeForWeek(2026, 99);
    expect(seasonType).toBeNull();
  });
});

describe('enrichWeekIdentifier', () => {
  it('should convert WeekIdentifier to WeekQuery', async () => {
    const weekQuery = await enrichWeekIdentifier({ year: 2024, week: 1 });
    expect(weekQuery.seasonType).toBe('regular');
  });

  it('should throw error for non-existent week', async () => {
    await expect(
      enrichWeekIdentifier({ year: 2026, week: 99 })
    ).rejects.toThrow('Week 99 of year 2026 not found');
  });
});
```

## Existing Functions to Reuse

- **`getWeekData(year: number)`** in `packages/backend/src/api/index.ts` - Already fetches weeks from CFBD with seasonType. Will be used for auto-loading weeks.
- **`getGameData(query: WeekQuery)`** in `packages/backend/src/api/index.ts` - Already handles CFBD game fetching. Will continue to be used with enriched WeekQuery.
- **Database query functions** - Already implemented correctly (don't filter by seasonType). Just need signature updates.

## Error Handling

**Scenario: Week doesn't exist in database**

When games are requested for a week that hasn't been loaded:
1. GET /getgames checks if week exists in database
2. If not, auto-loads all weeks for that year using `getWeekData(year)`
3. Then proceeds to fetch games
4. If week still doesn't exist after auto-load, `enrichWeekIdentifier()` throws clear error
5. Frontend displays error message to admin

**Scenario: CFBD API failure**

Existing error handling in `getGameData()` will continue to work - errors propagate to routes and are returned to frontend.

## Migration Notes

This is a **breaking change** that requires coordinated deployment:
1. Backend and frontend must be deployed together
2. Old frontend clients with seasonType will fail validation
3. No backward compatibility layer (clean break)

## Verification Steps

### After Implementation:

1. **Run backend tests:**
   ```bash
   cd packages/backend
   pnpm test
   ```

2. **Run frontend tests:**
   ```bash
   cd packages/frontend
   pnpm test
   ```

3. **Manual testing (with fresh database):**
   - Start PostgreSQL: `docker compose -f docker/docker-compose-pg.yml up -d`
   - Run migrations: `cd packages/backend && pnpm migrate`
   - Start backend: `pnpm dev:backend`
   - Start frontend: `pnpm dev:frontend`

4. **Admin workflow test:**
   - Log in as admin
   - Select a year (e.g., 2024) - weeks should auto-load from CFBD
   - Select week 1 - games should auto-load
   - Mark several games as picked
   - Save - picked games should persist
   - Reload page - picked games should still be marked

5. **User workflow test:**
   - Log in as regular user
   - Navigate to picks page
   - Select year and week with picked games
   - Games should display correctly
   - Make picks and save

6. **Postseason test (future):**
   - Select a postseason week (week 16+)
   - Verify games load correctly with seasonType='postseason'

7. **Check browser console and backend logs:**
   - No errors should appear
   - Verify correct API calls being made

## Rollback Plan

If issues occur:
1. Git revert the changes
2. Redeploy previous version
3. Clear browser localStorage to reset JWT tokens

## Edge Cases Handled

1. **Week doesn't exist** - Auto-loads weeks for the year
2. **Games don't exist** - Fetches from CFBD using looked-up seasonType
3. **Postseason weeks** - seasonType correctly retrieved from weeks table
4. **NCAA API** - Doesn't use seasonType, continues to work as-is
5. **Database constraints** - Unique constraint on (year, weekNumber) prevents duplicate weeks
