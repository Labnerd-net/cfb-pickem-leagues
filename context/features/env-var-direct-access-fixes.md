# Plan: Env Var Direct Access Fixes

## Overview

Two mechanical substitutions across two files. No behavior change.

## Changes

### 1. `packages/backend/src/routes/auth.ts`

- Add `clientURLs` to the existing `envVars.js` import (line 13–20).
- Line 71: replace `${process.env.CLIENT_URL?.split(',')[0] ?? ''}` with `${clientURLs[0] ?? ''}`.
- Line 151: same replacement.

### 2. `packages/backend/src/utils/rateLimiter.ts`

- Add a new import: `import { trustProxy } from '../utils/envVars.js';`
- Remove line 46: `const trustProxy = process.env.TRUST_PROXY === 'true';`
  The module-level import replaces it; no other changes needed.

## Verification

- `pnpm build` passes.
- `pnpm test:backend` passes (no test changes expected; if any test stubs `process.env.TRUST_PROXY` or `process.env.CLIENT_URL` directly, those may need to mock the module import instead — investigate if tests fail).
