# Testing with PGlite

## Overview

This project uses **PGlite** for testing - a WASM-compiled PostgreSQL that runs in-memory. This eliminates the need for Docker containers during testing while providing true PostgreSQL functionality.

## Benefits

- **No Docker dependency**: Tests run with just `pnpm test`
- **True PostgreSQL**: Full compatibility with production schema (pgSchema, arrays, etc.)
- **Test isolation**: Each test file gets a fresh database instance
- **Simplified CI/CD**: No container orchestration needed
- **Fast enough**: ~228ms boot time per test file is negligible for the benefits

## How It Works

### Setup (`tests/setup.ts`)

The Vitest setup file mocks `src/db/index.ts` with a PGlite instance:

1. Creates a fresh PGlite client per test file
2. Executes CREATE SCHEMA and CREATE TABLE statements to match production schema
3. Exports the same API as production (`db`, `columnSeason`, `columnTeam`, `columnRole`)

### Test Utilities (`tests/db-utils.ts`)

Helper functions for managing test data:

- `seedTestData()` - Insert default test users and week
- `cleanDatabase()` - TRUNCATE all tables (use in `afterEach` if tests need isolation)
- `createTestUser()` - Create a user with specific roles
- `createTestWeek()` - Create a test week
- `createTestGame()` - Create a test game

All helpers use the mocked `db` instance automatically.

### Writing Tests

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { seedTestData } from '../../db-utils.js';
import { returnUsers } from '../../../src/db/dbUserFunctions.js';

describe('My Database Tests', () => {
  beforeAll(async () => {
    await seedTestData();  // Set up initial data
  });

  // Optional: only if tests need isolation within the same file
  afterEach(async () => {
    await cleanDatabase();
    await seedTestData();
  });

  it('should return users', async () => {
    const users = await returnUsers();
    expect(users.length).toBeGreaterThan(0);
  });
});
```

### Key Points

- Each test **file** gets its own PGlite instance (isolated from other files)
- Tests within the same file **share** the database instance
- Use `afterEach` with `cleanDatabase()` if tests in the same file need isolation
- Production code imports `db` from `src/db/index.ts` - it gets mocked automatically
- No need to pass database instances around - the mock is global per test file

## Running Tests

```bash
# Run all tests
pnpm test

# Run in watch mode
pnpm test:watch

# Run with UI
pnpm test:ui

# Run with coverage
pnpm test:coverage
```

## Migration from Docker PostgreSQL

The old approach required:
- Docker container running on port 5433
- Manual database creation and migrations
- Connection via `postgres://` URL
- Cleanup between test runs

The new approach:
- No external dependencies
- Schema created automatically from SQL
- In-memory database per test file
- Fresh state for each test file

## Updating the Schema

When you modify the database schema:

1. Update the production schema files in `src/db/schema/`
2. Update the SQL in `tests/setup.ts` to match
3. Run `pnpm generate` for production migrations
4. Tests use the SQL directly - no migrations needed

## Performance

Boot time per test file: ~228ms (includes PGlite init + schema creation)
- Actual PGlite init: ~0.5ms
- Import overhead: ~227ms

This is acceptable given the benefits of simplified infrastructure and true test isolation.
