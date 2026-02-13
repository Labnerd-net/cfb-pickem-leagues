# Spec for Add Vitest Testing Suite

branch: claude/feature/add-vitest-tests

## Summary
Implement comprehensive testing coverage using Vitest for both backend and frontend packages. Focus on critical features, high-risk logic, and core business functionality to ensure reliability and prevent regressions. Tests should cover authentication flows, database operations, API integrations, route handlers, and frontend components.

## Functional Requirements
- Install and configure Vitest in both backend and frontend packages
- Create test files organized by domain in `./tests` folders for each package
- Test backend critical paths:
  - Authentication middleware and JWT handling
  - Role-based authorization (requireRole guards)
  - Database functions (admin and user schemas)
  - API adapter converters (NCAA, CFBD, SportsDataverse)
  - Route handlers and response wrappers
  - ID generation strategies (week IDs, user game IDs)
- Test frontend critical paths:
  - API request functions (userRequests, adminRequests)
  - Form validation logic (React Hook Form + Zod schemas)
  - Authentication context and token management
  - Critical user workflows (login, making picks, viewing results)
- Configure test scripts in package.json for both packages
- Set up test coverage reporting
- Ensure tests can run in CI/CD pipeline

## Possible Edge Cases
- Database connection failures during tests (mock DB appropriately)
- JWT token expiration and refresh scenarios
- External API data source unavailability (mock external API calls)
- Invalid or malformed data from external sources
- Race conditions in async database operations
- Frontend localStorage unavailability
- Network errors in API requests
- Invalid user input in forms
- SQLite vs PostgreSQL behavior differences in DB functions
- First user registration (auto-admin assignment)

## Acceptance Criteria
- Vitest is properly configured in both packages with appropriate config files
- Test files exist in `./tests` folders organized by domain
- Backend has tests covering:
  - At least 3 authentication/authorization scenarios
  - At least 5 database function test cases
  - At least 2 API adapter converter test cases
  - At least 3 route handler test cases
- Frontend has tests covering:
  - At least 3 API request function scenarios
  - At least 2 form validation test cases
  - At least 2 authentication flow scenarios
- All tests pass on first implementation
- Test scripts can be run via `pnpm test` in each package
- Coverage reports are generated and viewable
- Tests use appropriate mocking for external dependencies
- Test execution time is reasonable (under 30 seconds for full suite)

## Open Questions
- Should we aim for a specific code coverage percentage target?  - I wouldn't know what to target, so no for now.
- Do we need separate test databases or should we mock all DB operations?  - We can create a separate test database if it is not to difficult.
- Should integration tests be included or focus on unit tests only?  - Lets do just unit tests for now.
- Do we need E2E tests or is that out of scope for this spec?  - Not for now.  I will look at this later
- Should we test both SQLite and PostgreSQL DB implementations?  - No. Just Postgres.  I will remove any reference to SQLite DB implementations.

## Testing Guidelines
Create test files in the ./tests folder for each package. Focus on:
- Critical authentication and authorization logic
- Database query correctness and edge cases
- API data transformation and validation
- Error handling and response formatting
- Form validation rules
- API request error handling and retries
- High-risk calculation logic (week IDs, composite keys)

Do not over-test:
- Simple getter/setter functions
- Direct passthrough functions with no logic
- Third-party library functionality
- UI rendering (unless critical business logic is embedded)

## Personal Opinion
This is a good and necessary change. The application handles user authentication, game picks, and scoring logic—all critical features that should have test coverage to prevent bugs in production. The codebase has high-risk areas (composite key ID generation, JWT auth, external API integration) that would benefit significantly from automated tests.

The complexity is appropriate: setting up Vitest is straightforward, and the testing strategy focuses on high-value areas rather than chasing 100% coverage. This should provide good ROI without being overly burdensome to maintain.

One concern: testing database operations may require careful setup to avoid flaky tests. Consider using an in-memory SQLite database for backend tests to keep them fast and isolated.
