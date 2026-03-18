# Plan: Error Boundary Hookup and Dead Code Removal

## Context

Two small, isolated fixes from backlog [13] and [14]:

- **[13]** `ErrorBoundary` is a fully-implemented class component that is never mounted. Any render exception in a route component (or Navbar) produces a blank white screen with no feedback. Wiring it in costs one import and one JSX wrapper.
- **[14]** `addGameToWeek` is a bare-insert function superseded by `upsertGameForWeek` (idempotent, preserves `picked`/`gameId`). Confirmed zero callers in routes, cron, or tests — only appears in context/features planning docs (not code). Keeping it invites accidental use.

---

## Fix 1 — Wire up ErrorBoundary [13]

**File:** `packages/frontend/src/App.tsx`

**Placement:** Wrap the entire `<BrowserRouter>` so any render error from `Navbar`, `Routes`, or any route component is caught.

```
ThemeProvider
  AuthProvider
    ErrorBoundary      ← insert here
      BrowserRouter
        Box
          Navbar
          Routes ...
```

**Steps:**
1. Add `import ErrorBoundary from './components/ErrorBoundary';` to `App.tsx`.
2. Wrap `<BrowserRouter>...</BrowserRouter>` with `<ErrorBoundary>`.

No changes to `ErrorBoundary.tsx` — the component is complete and correct.

---

## Fix 2 — Remove addGameToWeek [14]

**File:** `packages/backend/src/db/dbAdminFunctions.ts`

Lines 96–125 contain `addGameToWeek`. It is exported but has zero callers in production code.

**Steps:**
1. Delete the full `addGameToWeek` function (lines ~96–125 including the comment block).
2. Verify no remaining references with a grep for `addGameToWeek` across `packages/`.

---

## Verification

1. `pnpm build` — must pass with no errors.
2. TypeScript check: `npx tsc --noEmit -p packages/frontend/tsconfig.app.json` and `npx tsc --noEmit -p packages/backend/tsconfig.json`.
3. Manual browser test: confirm the app loads normally.
4. Grep for `addGameToWeek` in `packages/` — must return zero results.
