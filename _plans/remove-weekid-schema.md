# Implementation Plan: Remove weekId Schema Variable

## Context

The current database schema uses a computed `weekId` column as the primary key for weeks, calculated as `year * 1000 + adjustment + weekNumber` where adjustment is 0 for regular season, 100 for postseason, and 900 for other types. This encoding couples three separate fields into a single integer, making the schema harder to understand and query.

This refactoring removes `weekId` entirely and replaces it with a composite primary key of `(year, weekNumber)` on the `adminWeeks` table. This change affects 40+ references across 8 backend files and includes fixing two latent bugs:

1. **NCAA aggregate row bug**: The last entry in the NCAA schedule-alt API response is an aggregate summary of all postseason games, not a real week. The current converter inserts this as a week.
2. **CFBD week numbering inconsistency**: CFBD splits weeks by seasonType (regular weeks 1-16, postseason weeks 1-7), while NCAA numbers weeks continuously (1-21). We need to normalize CFBD postseason weeks to continuous numbering (e.g., postseason week 1 → week 17).

The frontend will continue sending `year`, `week`, and `seasonType` as query parameters. The backend keeps `seasonType` for external API calls, but it no longer participates in key computation.

## Implementation Steps

### 1. Update Shared Types (Foundation Layer)

**File**: `packages/shared/types/cfb-pickem-api.ts`

Remove `weekId` from all data interfaces and rename `WeekIdData` to `WeekQuery`:

```typescript
// Remove weekId: number from these interfaces:
export interface AdminWeekData { ... }
export interface AdminGameData { ... }
export interface UserGameData { ... }

// Rename this interface
export interface WeekQuery {  // was WeekIdData
  year: number;
  week: number;
  seasonType: SeasonType;
}

// Update extends clauses
export interface PickedGamesData extends WeekQuery { ... }
export interface AllUserGamePicks extends WeekQuery { ... }
```

This change must come first to let TypeScript catch all downstream references.

### 2. Update Validation Schemas

**File**: `packages/backend/src/utils/zValidate.ts`

Rename the validation schema to match the type rename:

```typescript
const weekQuerySchema: z.ZodType<WeekQuery> = z.object({ ... });
export const weekQueryValidator = zValidator('json', weekQuerySchema);
```

### 3. Fix API Converters and Remove returnID()

**File**: `packages/backend/src/api/index.ts`

#### 3a. Fix NCAA converter in `getWeekData()`

Filter out the aggregate row (last entry):

```typescript
else if (dataSource === 'ncaa') {
  const ncaaSchedule = await getNcaaSchedule(year);
  const games = ncaaSchedule?.data?.schedules?.games ?? [];
  const filteredGames = games.slice(0, -1);  // Remove aggregate row

  filteredGames.forEach((week, index: number) => {
    const dates = week.contestDate.split('-');
    const data = {} as AdminWeekData;
    // Remove: data.weekId = id;
    data.weekNumber = index + 1;
    data.year = ncaaYear;
    data.seasonType = ncaaSeasonType;
    data.weekStart = dates[0];
    data.weekEnd = dates[1];
    weekData.push(data);
  });
}
```

#### 3b. Fix CFBD converter with continuous week numbering

Renumber postseason weeks to continue from the last regular season week:

```typescript
if (dataSource === 'cfbd') {
  const cfbdWeekData = await getCfbdWeekData(year);

  const regularWeeks = cfbdWeekData?.filter(w => w.seasonType === 'regular') ?? [];
  const regularWeekCount = Math.max(...regularWeeks.map(w => w.week), 0);

  cfbdWeekData?.forEach(week => {
    const data = {} as AdminWeekData;

    if (week.seasonType === 'postseason') {
      data.weekNumber = regularWeekCount + week.week;  // e.g., 16 + 1 = 17
    } else {
      data.weekNumber = week.week;
    }

    // Remove: data.weekId = id;
    data.year = week.season;
    data.seasonType = week.seasonType;
    data.weekStart = week.startDate;
    data.weekEnd = week.endDate;
    weekData.push(data);
  });
}
```

#### 3c. Update `getGameData()` function

```typescript
export async function getGameData(
  queryData: WeekQuery,  // renamed from idData
  classification: Classification = 'fbs'
): Promise<AdminGameData[]> {
  // Remove: const id = returnID(idData);

  // In both CFBD and NCAA branches, remove:
  //   data.weekId = id;
  // Already has:
  //   data.weekNumber = queryData.week;
  //   data.year = queryData.year;
  //   data.seasonType = queryData.seasonType;
}
```

#### 3d. Delete `returnID()` function entirely

Remove lines 133-148 (the entire function definition).

### 4. Update Database Schemas

**File**: `packages/backend/src/db/schema/admin.ts`

```typescript
export const adminWeeks = adminSchema.table('weeks', {
  // Remove: weekId: integer('week_id').notNull().primaryKey(),
  weekNumber: integer('week_number').notNull(),
  year: integer('year').notNull(),
  seasonType: columnSeason('season_type').notNull(),
  weekStart: date('week_start').notNull(),
  weekEnd: date('week_end').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ([
  primaryKey({ columns: [table.year, table.weekNumber] }),  // Add composite PK
  index('weeks_year_season_idx').on(table.year, table.seasonType),
]));

export const adminGames = adminSchema.table('games', {
  gameId: serial('game_id').primaryKey(),
  cfbdGameId: integer('cfbd_game_id'),
  ncaaGameId: text('ncaa_game_id'),
  // Remove entire weekId field and foreign key
  picked: boolean('picked').notNull(),
  weekNumber: integer('week_number').notNull(),
  year: integer('year').notNull(),
  seasonType: columnSeason('season_type').notNull(),
  // ... rest unchanged
}, (table) => ([
  // Add composite foreign key
  table.foreignKey({
    columns: [table.year, table.weekNumber],
    foreignColumns: [adminWeeks.year, adminWeeks.weekNumber],
    name: 'games_week_fk'
  }).onDelete('cascade'),

  index('games_year_week_idx').on(table.year, table.weekNumber),
  index('games_picked_idx').on(table.picked),
  index('games_year_week_picked_idx').on(table.year, table.weekNumber, table.picked),
]));
```

**File**: `packages/backend/src/db/schema/users.ts`

```typescript
export const games = userSchema.table('games', {
  userId: integer('user_id').notNull().references(() => users.userId, { onDelete: 'cascade' }),
  gameId: integer('game_id').notNull(),
  cfbdGameId: integer('cfbd_game_id'),
  ncaaGameId: text('ncaa_game_id'),
  // Remove: weekId: integer('week_id').notNull(),
  weekNumber: integer('week_number').notNull(),
  year: integer('year').notNull(),
  // ... rest unchanged
}, (table) => ([
  primaryKey({ columns: [table.userId, table.gameId] }),
  index('user_games_year_week_idx').on(table.year, table.weekNumber),
  index('user_games_user_year_week_idx').on(table.userId, table.year, table.weekNumber),
]));
```

### 5. Update Database Functions

**File**: `packages/backend/src/db/dbAdminFunctions.ts`

Remove `returnID` import and update all query functions:

```typescript
// Remove import: import { returnID } from '../api/index.js';
import type { ..., WeekQuery } from '@shared/types/cfb-pickem-api.js';  // renamed

export async function returnWeekByQuery(query: WeekQuery): Promise<AdminWeekData[]> {
  // Remove: const id = returnID(idData);
  return await db.select().from(adminWeeks).where(
    and(eq(adminWeeks.year, query.year), eq(adminWeeks.weekNumber, query.week))
  );
}

export async function returnGamesForWeek(query: WeekQuery): Promise<AdminDbGameData[]> {
  return await db.select().from(adminGames).where(
    and(eq(adminGames.year, query.year), eq(adminGames.weekNumber, query.week))
  );
}

export async function addWeek(week: AdminWeekData): Promise<void> {
  await db.insert(adminWeeks).values({
    // Remove: weekId: week.weekId,
    weekNumber: week.weekNumber,
    year: week.year,
    // ... rest unchanged
  });
}

export async function addGameToWeek(game: AdminGameData): Promise<void> {
  await db.insert(adminGames).values({
    // Remove: weekId: game.weekId,
    cfbdGameId: game.cfbdGameId,
    // ... rest unchanged
  });
}

export async function returnPickedGames(query: WeekQuery): Promise<AdminDbGameData[]> {
  return await db.select().from(adminGames).where(
    and(
      eq(adminGames.year, query.year),
      eq(adminGames.weekNumber, query.week),
      eq(adminGames.picked, true)
    )
  );
}
```

**File**: `packages/backend/src/db/dbUserFunctions.ts`

```typescript
// Remove import: import { returnID } from '../api/index.js';
import type { ..., WeekQuery } from '@shared/types/cfb-pickem-api.js';

export async function addPickedGame(pick: UserGamePicks, userId: string): Promise<void> {
  const gameInfo = await dbAdminFunctions.returnGame(pick.game);
  await db.insert(games).values({
    userId: userIdNumber,
    gameId: pick.game,
    // Remove: weekId: gameInfo[0].weekId,
    weekNumber: gameInfo[0].weekNumber,
    year: gameInfo[0].year,
    // ... rest unchanged
  });
}

export async function returnUserGames(query: WeekQuery, userId: string): Promise<UserDbGameData[]> {
  return await db.select().from(games).where(
    and(
      eq(games.year, query.year),
      eq(games.weekNumber, query.week),
      eq(games.userId, userIdNumber)
    )
  );
}
```

### 6. Update Route Handlers

**File**: `packages/backend/src/routes/admin.ts`

```typescript
import type { ..., WeekQuery } from '@shared/types/cfb-pickem-api.js';  // renamed

admin.post('/week', requireRole('admin'), async c => {
  const weekQuery: WeekQuery = await c.req.json();  // renamed type
  const gameData = await getGameData(weekQuery);
  // ... rest unchanged
});

admin.get('/getgames', requireRole('admin'), async c => {
  const weekQuery: WeekQuery = {  // renamed variable
    year: Number(c.req.query('year')),
    week: Number(c.req.query('week')),
    seasonType: (c.req.query('seasonType') || 'regular') as SeasonType,
  };
  const weekGames = await dbAdminFunctions.returnGamesForWeek(weekQuery);
  // ... rest unchanged
});
```

**File**: `packages/backend/src/routes/user.ts`

Same pattern: rename `WeekIdData` to `WeekQuery` in imports and variable declarations. No logic changes.

### 7. Update API Adapters

**File**: `packages/backend/src/api/cfbd.ts`

```typescript
import type { Classification, WeekQuery } from '@shared/types/cfb-pickem-api.js';

export async function getCfbdGameData(query: WeekQuery, classification: Classification = 'fbs') {
  // ... rest unchanged, already uses query.year, query.week, query.seasonType
}
```

**File**: `packages/backend/src/api/ncaa-api.ts`

```typescript
import type { Classification, WeekQuery } from '@shared/types/cfb-pickem-api.js';

export async function getNcaaScoreboard(query: WeekQuery, classification: Classification = 'fbs', sport: string = 'football') {
  // ... rest unchanged
}
```

### 8. Update Frontend Types

**Files**: Search all frontend files for `WeekIdData` and replace with `WeekQuery`:

- `packages/frontend/src/apis/adminRequests.ts`
- `packages/frontend/src/apis/userRequests.ts`
- Any components importing the type

Just type renames, no logic changes needed.

### 9. Update Tests

**File**: `packages/backend/tests/unit/api/converters.test.ts`

Delete the entire `returnID` test suite (lines 6-71). Add new tests:

```typescript
describe('getWeekData', () => {
  it('should filter out NCAA aggregate row', async () => {
    // Mock NCAA response with aggregate row as last entry
    // Verify filtered weeks don't include it
  });

  it('should renumber CFBD postseason weeks continuously', async () => {
    // Mock CFBD response with regular weeks 1-16, postseason weeks 1-7
    // Verify postseason week 1 becomes week 17
  });
});
```

**File**: `packages/backend/tests/unit/db/dbAdminFunctions.test.ts`

Update all test cases to use `WeekQuery` instead of `WeekIdData` and remove `weekId` from assertions.

**File**: `packages/backend/tests/db-utils.ts`

Update test data factories to remove `weekId` parameter from `createTestWeek()` and `createTestGame()`.

### 10. Generate and Run Database Migration

**Commands**:
```bash
cd packages/backend
pnpm generate  # Generates migration file
pnpm migrate   # Applies migration
```

**Expected migration actions**:
- Drop foreign key constraint from `admin.games.week_id`
- Drop indexes on `week_id` columns
- Drop primary key from `admin.weeks`
- Add composite primary key to `admin.weeks (year, week_number)`
- Add composite foreign key to `admin.games (year, week_number)` → `admin.weeks`
- Drop `week_id` columns from all three tables
- Create new indexes on `(year, week_number)`

**Data preservation**: Since `year` and `weekNumber` columns already exist in all tables, no data migration is needed. Dropping `weekId` doesn't affect other columns.

## Critical Files

- `packages/shared/types/cfb-pickem-api.ts` - Core type definitions
- `packages/backend/src/api/index.ts` - Contains returnID() and converter bugs to fix
- `packages/backend/src/db/schema/admin.ts` - Composite PK/FK definition
- `packages/backend/src/db/schema/users.ts` - User games schema
- `packages/backend/src/db/dbAdminFunctions.ts` - 7 functions with query changes
- `packages/backend/src/db/dbUserFunctions.ts` - User game queries
- `packages/backend/src/routes/admin.ts` - Admin route handlers
- `packages/backend/src/routes/user.ts` - User route handlers

## Verification

After implementation, verify:

1. **Week creation**: POST to `/admin/year/2025` creates weeks without weekId
2. **NCAA filtering**: Verify last entry in NCAA response is excluded (check inserted week count)
3. **CFBD renumbering**: Verify postseason weeks are numbered 17+ (not reset to 1)
4. **Game insertion**: POST to `/admin/week` successfully creates games with composite FK
5. **Queries work**: GET `/admin/getgames?year=2025&week=1&seasonType=regular` returns games
6. **User picks**: POST/GET `/user/picks` work correctly with composite key queries
7. **Foreign key cascade**: Delete a week → verify games are cascade deleted
8. **Run tests**: `pnpm test` in backend package passes

## Execution Order Rationale

1. **Types first** - TypeScript compiler catches all downstream changes
2. **Converters before schemas** - Fixes bugs before database changes
3. **Schemas before functions** - Database structure must exist before queries
4. **Functions before routes** - Routes depend on function signatures
5. **Migration last** - All code must be ready before schema changes in database

This order minimizes breaking changes and ensures each layer is ready before the next depends on it.
