# Test Action

1. Read current-feature.md 
  - read "Spec file:" file to understand the goals
  - read "Plan file:" file to uderstand implementation
2. Identify server actions and utility functions added/modified for this feature
3. Check if tests already exist for these functions
4. For functions without tests that have testable logic, write unit tests:
  - Create unit tests using Vitest
  - Focus on server actions and utilities (not components)
  - Test happy path and error cases
  - Do not write tests just to write them. Use your best judgement
5. Run `npm test` to verify all tests pass
6. Report test coverage for the new feature code