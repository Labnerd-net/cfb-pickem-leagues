# Implementation Plan: Add Vitest Testing Suite

## Context

The CFB Pick'em application currently lacks automated test coverage despite having critical business logic around authentication, game picks, and admin curation workflows. The backend has manual Bruno REST tests, but no unit or integration tests. The frontend has no testing infrastructure at all.

This implementation adds comprehensive Vitest testing to both packages, focusing on:
- **High-risk logic**: Auth flows, database operations with known bugs, API data converters
- **Critical features**: User registration (first user auto-admin), JWT middleware, pick submission
- **Form validation**: Zod schemas for login/registration
- **State management**: Auth context and token lifecycle

The user has specified: PostgreSQL only (not SQLite), unit tests focus (no E2E/integration), separate test database acceptable, coverage reporting enabled.

---

## Implementation Strategy

### Phase 1: Infrastructure Setup (Day 1)

**1.1 Install Dependencies**

Backend:
```bash
cd packages/backend
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui @types/bcryptjs
```

Frontend:
```bash
cd packages/frontend
pnpm add -D vitest @vitest/coverage-v8 @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw
```

**1.2 Create Backend Configuration**

File: `packages/backend/vitest.config.ts`
- Environment: node
- Setup file: `./tests/setup.ts`
- Coverage provider: v8 with text, html, json-summary reporters
- Test timeout: 10000ms (for DB operations)
- Path aliases: `@shared/*` to match tsconfig

**1.3 Create Frontend Configuration**

File: `packages/frontend/vitest.config.ts`
- Environment: jsdom
- Setup file: `./tests/setup.ts`
- Coverage provider: v8 with text, html, json-summary reporters
- Test timeout: 5000ms
- Include only: `src/**/*.{ts,tsx}`
- Path aliases: `@shared/*` to match tsconfig

**1.4 Setup Test Database**

Create separate PostgreSQL database for testing:
```bash
# In postgres container or local instance
createdb cfb-pickem-test

# Run migrations against test database
cd packages/backend
NODE_ENV=test pnpm migrate
```

**1.5 Create Backend Setup File**

File: `packages/backend/tests/setup.ts`
- Override `DB_NAME` to `cfb-pickem-test`
- Set `NODE_ENV=test`
- Set test `JWT_SECRET`
- Verify test database connection
- Set global test timeout

**1.6 Create Frontend Setup File**

File: `packages/frontend/tests/setup.ts`
- Import `@testing-library/jest-dom`
- Mock `localStorage` globally
- Mock `window.matchMedia` for Material-UI
- Setup MSW server with `beforeAll`/`afterEach`/`afterAll` hooks

**1.7 Create Test Utilities**

Backend file: `packages/backend/tests/db-utils.ts`
- `getTestDb()`: Returns Drizzle instance for test database
- `cleanDatabase()`: Truncates all tables respecting FK constraints
- `seedTestData()`: Inserts minimal fixture data
- `createTestUser(roles)`: Helper to create test users
- `createTestWeek(idData)`: Helper to create test weeks/games

Frontend file: `packages/frontend/tests/test-utils.tsx`
- Custom `renderWithProviders()` wrapping with `MemoryRouter` + `AuthProvider`
- Accept `initialRoute` and `authState` options
- Re-export all `@testing-library/react` utilities

Frontend file: `packages/frontend/tests/mocks/handlers.ts`
- MSW handlers for auth, user, admin API endpoints
- Return fixture data matching backend response format

Frontend file: `packages/frontend/tests/mocks/server.ts`
- Create MSW server with handlers
- Export for use in setup.ts

**1.8 Add Test Scripts**

Root `package.json`:
```json
{
  "scripts": {
    "test": "pnpm -r run test",
    "test:backend": "pnpm --filter backend test",
    "test:frontend": "pnpm --filter frontend test",
    "test:coverage": "pnpm -r run test -- --coverage"
  }
}
```

Backend `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

Frontend `package.json`: Same as backend

**1.9 Verify Setup**

Run empty test suite to verify configuration:
```bash
pnpm test:backend
pnpm test:frontend
```

---

### Phase 2: Backend Core Tests (Day 2-3)

**2.1 Utility Tests** (Priority: P0)

File: `packages/backend/tests/unit/utils/validation.test.ts`
- Test week ID encoding formula: `year * 1000 + adjustment + weekNumber`
- Test regular season (adjustment = 0): `returnID({ year: 2024, week: 1, seasonType: 'regular' })` → 2024001
- Test postseason (adjustment = 100): `returnID({ year: 2024, week: 1, seasonType: 'postseason' })` → 2024101
- Test other season (adjustment = 900): `returnID({ year: 2024, week: 1, seasonType: 'other' })` → 2024901
- Test email validation (valid/invalid formats)
- Test password validation (min length, empty)

File: `packages/backend/tests/unit/utils/response.test.ts`
- Test `ok(data)` returns `{ ok: true, data }`
- Test `err(message, code)` returns `{ ok: false, error: message, code }`

**2.2 Database Function Tests** (Priority: P0/P1)

File: `packages/backend/tests/unit/db/dbUserFunctions.test.ts`
- **CRITICAL**: Fix `invertPickedGame` bug at line 130 before testing
  - Current: `set({ picked: !adminGames.picked })` (invalid syntax)
  - Fixed: Compute boolean value outside, then set
- Test `addPickedGame`: Insert new pick (verify user game ID = gameId*1000+userId)
- Test `addPickedGame`: Update existing pick (upsert logic)
- Test `addPickedGame`: Calculate winning team correctly (home win, away win, tie, pending)
- Test `addPickedGame`: Throw error when game doesn't exist
- Test `returnUserGames`: Return picks for specific week
- Test `getUserGameResults`: Calculate results correctly

File: `packages/backend/tests/unit/db/dbAdminFunctions.test.ts`
- Test `addWeek`: Insert week with correct weekId
- Test `addGameToWeek`: Insert game, auto-calculate winner
- Test `invertPickedGame`: Toggle picked flag (test after fixing bug)
- Test `setPickedGame`: Bulk update picked games
- Test `returnPickedGames`: Filter by picked=true
- Test `returnGamesForWeek`: Return all games for week

Setup pattern for DB tests:
```typescript
describe('dbUserFunctions', () => {
  let testDb: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    testDb = getTestDb();
    await seedTestData(testDb);
  });

  afterEach(async () => {
    await cleanDatabase(testDb);
    await seedTestData(testDb);
  });
});
```

**2.3 API Converter Tests** (Priority: P2)

File: `packages/backend/tests/unit/api/converters.test.ts`
- Test `returnID` function (covered in validation tests, but verify here too)
- Test `getWeekData`: NCAA format → internal format
- Test `getWeekData`: CFBD format → internal format
- Test `getGameData`: Handle completed games (extract winner)
- Test `getGameData`: Handle incomplete games (scores = -1, winner = 'pending')
- Mock external API calls (mock `cfbd` package, mock NCAA fetch)

---

### Phase 3: Backend Auth & Routes (Day 4)

**3.1 Auth Middleware Tests** (Priority: P1)

File: `packages/backend/tests/unit/middleware/auth.test.ts`
- Mock `jsonwebtoken.verify()` to return test payload
- Test valid JWT token allows access
- Test expired JWT returns 401
- Test missing token returns 401
- Test malformed token returns 401
- Test token with missing userId fails

File: `packages/backend/tests/unit/middleware/requireRole.test.ts`
- Mock context with JWT payload
- Test admin role can access admin routes
- Test user role cannot access admin routes
- Test multiple roles work correctly
- Test missing role in payload returns 403

**3.2 Auth Route Tests** (Priority: P1)

File: `packages/backend/tests/integration/routes/auth.test.ts`
- **CRITICAL**: Test first user registration assigns both 'user' and 'admin' roles
- Test second user registration assigns only 'user' role
- Test registration with duplicate email returns 400
- Test login with valid credentials returns JWT
- Test login with invalid credentials returns 401
- Test deleteUser removes user and cascades picks
- Mock database functions, test route logic only

**3.3 User Route Tests** (Priority: P2)

File: `packages/backend/tests/integration/routes/user.test.ts`
- Test GET `/api/user/profile` returns user data
- Test GET `/api/user/games` with query params returns picked games
- Test POST `/api/user/picks` saves user picks
- Test GET `/api/user/picks` returns user's picks for week
- Mock auth middleware to inject test user
- Mock database functions

**3.4 Admin Route Tests** (Priority: P3)

File: `packages/backend/tests/integration/routes/admin.test.ts`
- Test POST `/api/admin/year/:year` fetches weeks
- Test POST `/api/admin/week` fetches games
- Test GET `/api/admin/getgames` returns games with picked status
- Test POST `/api/admin/setpicks` updates picked games
- Test POST `/api/admin/users` returns all users
- Mock auth middleware with admin role
- Mock database and API adapter functions

---

### Phase 4: Frontend Core Tests (Day 5)

**4.1 API Request Tests** (Priority: P0/P1)

File: `packages/frontend/tests/unit/apis/authRequests.test.ts`
- Setup MSW handlers in `mocks/handlers.ts`
- Test `loginUser`: Success returns token and user data
- Test `loginUser`: Failure throws error with message
- Test `registerUser`: Success creates user
- Test `registerUser`: Duplicate email returns error
- Test deleteUser sends request with auth token
- Verify Authorization header includes JWT from localStorage

File: `packages/frontend/tests/unit/apis/userRequests.test.ts`
- Test `getUserProfile`: Returns profile data
- Test `getUserPicks`: Query params constructed correctly
- Test `getPickedGames`: Returns games array
- Test `postUserPicks`: **NOTE - function currently has no payload, may need to fix**
- Test network errors handled gracefully

File: `packages/frontend/tests/unit/apis/adminRequests.test.ts`
- Test `addWeekstoYear`: Sends year parameter
- Test `addGamesToWeek`: Sends week data
- Test `getGamesForWeek`: Extracts nested response correctly
- Test `setPickedGames`: Sends picked game IDs

**4.2 Form Validation Tests** (Priority: P1)

File: `packages/frontend/tests/unit/validation/loginSchema.test.ts`
- Test valid email + password passes validation
- Test invalid email fails with error message
- Test password under 6 chars fails with error message
- Test empty fields fail validation

File: `packages/frontend/tests/unit/validation/registrationSchema.test.ts`
- Test valid form passes validation
- Test email validation
- Test displayName length (min 1, max 50)
- Test password min length (6 chars)
- Test password matching (refine logic)
- Test mismatched passwords fail with error on confirmPassword field

**4.3 Auth Context Tests** (Priority: P1)

File: `packages/frontend/tests/integration/contexts/AuthProvider.test.tsx`
- Test initialization: Token in localStorage → fetch profile → set user
- Test initialization: Invalid token → clear localStorage → set user to null
- Test initialization: No token → set user to null
- Test `login()`: Store token in localStorage, fetch profile, update state
- Test `login()`: Profile fetch fails → clear token, throw error
- Test `logout()`: Clear localStorage, set user to null
- Mock `getUserProfile` API call with MSW

**4.4 Component Tests** (Priority: P1/P2)

File: `packages/frontend/tests/integration/components/Login.test.tsx`
- Render with `renderWithProviders()`
- Test form submission with valid credentials calls `loginUser`
- Test successful login redirects to dashboard
- Test failed login displays error message
- Test form validation prevents submission with invalid input
- Test loading state disables submit button
- Use `@testing-library/user-event` for interactions

File: `packages/frontend/tests/integration/components/Registration.test.tsx`
- Test form submission with valid data calls `registerUser`
- Test password matching validation
- Test displayName length validation
- Test error display on registration failure

File: `packages/frontend/tests/integration/components/PrivateRoute.test.tsx`
- Test authenticated user can access route (render children)
- Test unauthenticated user redirects to `/login`
- Test loading state shows spinner
- Mock `useAuth()` hook to control auth state

File: `packages/frontend/tests/integration/components/AdminSection.test.tsx`
- Test game selection state management
- Test select all checkbox toggles all games
- Test save button calls `setPickedGames` with selected IDs
- Test save button disabled when no games selected
- Mock admin API requests

---

### Phase 5: Coverage & Polish (Day 6)

**5.1 Run Coverage Reports**

```bash
pnpm test:coverage
```

Review HTML reports:
- Backend: `packages/backend/coverage/index.html`
- Frontend: `packages/frontend/coverage/index.html`

**5.2 Identify Coverage Gaps**

Focus on:
- Uncovered branches in conditional logic
- Error handling paths
- Edge cases in validation functions

**5.3 Add Missing Test Cases**

Prioritize high-value gaps:
- Rate limiter tests (backend)
- Email validation edge cases
- Admin workflow error handling

**5.4 Update Documentation**

Add to root README.md:
```markdown
## Testing

Run tests for all packages:
\`\`\`bash
pnpm test
\`\`\`

Run tests with coverage:
\`\`\`bash
pnpm test:coverage
\`\`\`

Run tests in watch mode (development):
\`\`\`bash
cd packages/backend  # or frontend
pnpm test:watch
\`\`\`

View coverage reports:
- Backend: `packages/backend/coverage/index.html`
- Frontend: `packages/frontend/coverage/index.html`
```

---

## Critical Files to Modify

### Files with Known Bugs (Fix During Testing)

1. **packages/backend/src/db/dbAdminFunctions.ts:130**
   - Bug: `set({ picked: !adminGames.picked })` is invalid Drizzle syntax
   - Fix: Compute boolean value outside update, then set literal value

### High-Risk Files Requiring Thorough Testing

2. **packages/backend/src/db/dbUserFunctions.ts** (lines 96-131)
   - Complex upsert logic for `addPickedGame`
   - User game ID calculation: `gameId * 1000 + userId`
   - Winner calculation duplicated from admin layer

3. **packages/backend/src/routes/auth.ts** (lines 57-58)
   - First user auto-admin assignment
   - JWT generation and token signing

4. **packages/backend/src/utils/middleware.ts**
   - JWT verification in `authMiddleware`
   - Role enforcement in `requireRole`

5. **packages/backend/src/api/index.ts** (lines 133-148)
   - Week ID encoding: `year * 1000 + adjustment + weekNumber`
   - Data converters for NCAA/CFBD formats

6. **packages/frontend/src/contexts/auth/AuthProvider.tsx**
   - Token lifecycle management
   - Login/logout flows
   - Profile fetch on mount

7. **packages/frontend/src/pages/Login.tsx & Registration.tsx**
   - Zod schema validation
   - Form submission logic
   - Error display

---

## Test Database Setup

### Docker Compose Addition

Add test database to `docker/docker-compose-pg.yml`:
```yaml
services:
  postgres:
    # ... existing config
    environment:
      - POSTGRES_MULTIPLE_DATABASES=cfb-pickem,cfb-pickem-test
```

Or create manually:
```bash
docker exec -it <postgres-container> psql -U postgres
CREATE DATABASE "cfb-pickem-test";
\q

cd packages/backend
NODE_ENV=test pnpm migrate
```

### Environment Variables for Testing

Backend tests require:
- `DB_NAME=cfb-pickem-test`
- `NODE_ENV=test`
- `JWT_SECRET=test-secret-key`
- All other DB vars same as dev

Frontend tests require:
- `VITE_API_URL=http://localhost:3000` (mocked via MSW)

---

## Verification Steps

### After Phase 1 (Infrastructure)
```bash
# Verify configs created
ls packages/backend/vitest.config.ts
ls packages/frontend/vitest.config.ts

# Verify test scripts work (no tests yet)
pnpm test:backend
pnpm test:frontend
```

### After Phase 2-4 (Test Implementation)
```bash
# Run all tests
pnpm test

# Expected output:
# Backend: ~25-30 tests passing
# Frontend: ~20-25 tests passing
# Total execution time: < 30 seconds
```

### After Phase 5 (Coverage)
```bash
# Generate coverage reports
pnpm test:coverage

# Check coverage in browser
open packages/backend/coverage/index.html
open packages/frontend/coverage/index.html

# Verify acceptance criteria:
# - At least 3 auth/authz scenarios ✓
# - At least 5 DB function test cases ✓
# - At least 2 API converter test cases ✓
# - At least 3 route handler test cases ✓
# - At least 3 API request test scenarios ✓
# - At least 2 form validation test cases ✓
# - At least 2 auth flow test scenarios ✓
```

### Manual Testing
```bash
# Start backend with test database
cd packages/backend
NODE_ENV=test pnpm dev:backend

# Verify test data doesn't affect dev database
psql -U postgres -d cfb-pickem -c "SELECT COUNT(*) FROM admin.weeks;"
psql -U postgres -d cfb-pickem-test -c "SELECT COUNT(*) FROM admin.weeks;"
```

---

## Implementation Order Summary

**Day 1**: Infrastructure (vitest configs, setup files, test utilities, MSW handlers)
**Day 2-3**: Backend core (utilities, DB functions, API converters)
**Day 4**: Backend auth & routes (middleware, auth routes, user/admin routes)
**Day 5**: Frontend core (API requests, validation, auth context, components)
**Day 6**: Coverage & polish (fill gaps, documentation, verification)

**Total effort**: 6 days

---

## Acceptance Criteria Verification

- [x] Vitest configured in both packages (vitest.config.ts files)
- [x] Test files organized in `./tests` folders by domain
- [x] Backend: 3+ auth/authz test scenarios (middleware, requireRole, auth routes)
- [x] Backend: 5+ DB function test cases (addPickedGame, invertPickedGame, addWeek, setPickedGame, returnGames)
- [x] Backend: 2+ API converter test cases (returnID, getWeekData)
- [x] Backend: 3+ route handler test cases (auth, user, admin routes)
- [x] Frontend: 3+ API request test scenarios (login, register, getUserProfile)
- [x] Frontend: 2+ form validation test cases (loginSchema, registrationSchema)
- [x] Frontend: 2+ auth flow test scenarios (login, logout, token validation)
- [x] `pnpm test` scripts in each package
- [x] Coverage reports generated (HTML, text, JSON)
- [x] External dependencies mocked (MSW for frontend, vi.mock for backend)
- [x] Tests designed to complete in < 30 seconds

---

## Risk Mitigation

**Risk**: Test database setup complexity
**Mitigation**: Document clear setup steps, provide docker-compose snippet, create helper script

**Risk**: Tests exceed 30-second timeout
**Mitigation**: Run in parallel (Vitest default), truncate tables per file (not per test), use transactions

**Risk**: React 19 compatibility with Testing Library
**Mitigation**: Use latest @testing-library/react, monitor for issues, fallback to React 18 if needed

**Risk**: Flaky async tests
**Mitigation**: Use `waitFor` and `findBy*` queries, avoid hardcoded timeouts, increase test timeout for specific tests

**Risk**: Coverage targets not met
**Mitigation**: Focus on high-value tests first, accept lower coverage (targets are aspirational)
