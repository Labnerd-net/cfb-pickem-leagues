# Fix: Cron Week Reset, Settings Error Handling, Email Transporter Singleton

**Branch:** `claude/fix/fix-cron-settings-email`
**Fixes:** [10] cronTick.ts week state reset, [11] Settings.tsx load error handling, [17] emailSender.ts transporter singleton

---

## Step 1: Create branch

```bash
git checkout -b claude/fix/fix-cron-settings-email
```

---

## Step 2: Fix [10] — cronTick.ts week state reset

**File:** `packages/backend/src/cron/cronTick.ts`

Add a fourth module-level variable after the existing three:

```ts
let lastWeekKey: string | null = null;
```

Inside `runCronTick`, after `weekKey` is computed (line 31), insert a week-change guard before anything uses `hardCapStart` or `lastRefreshAt`:

1. Compare `weekKey` to `lastWeekKey`.
2. If different: set `hardCapStart = null`, `lastRefreshAt = null`, `lastWeekKey = weekKey`, log at `info` level with `weekKey` in context.
3. If same: do nothing, fall through.

`scoresCompletedForWeek` already guards by weekKey — no change needed there.

**Why safe:** The reset happens before the `hardCapStart` evaluation at line 53, so the new week starts with clean state. Resetting `lastRefreshAt` forces an immediate score refresh attempt on the first tick of the new week.

---

## Step 3: Fix [11] — Settings.tsx load error handling

**File:** `packages/frontend/src/pages/Settings.tsx`

1. Add a new state variable alongside the existing ones:
   ```ts
   const [loadError, setLoadError] = useState<string | null>(null);
   ```

2. Replace the `useEffect` block (lines 42–48) with an async/await version using `try/finally`:
   ```ts
   useEffect(() => {
     async function load() {
       try {
         const [settingsRes, channelsRes] = await Promise.all([
           getNotificationSettings(),
           getBroadcastChannels(),
         ]);
         if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data);
         if (channelsRes.success && channelsRes.data) setChannels(channelsRes.data);
       } catch {
         setLoadError('Failed to load settings. Please refresh the page.');
       } finally {
         setLoading(false);
       }
     }
     load();
   }, []);
   ```

3. Add an error branch in the render section immediately after the `if (loading)` block:
   ```tsx
   if (loadError) {
     return (
       <Box display="flex" justifyContent="center" mt={8}>
         <Typography color="error">{loadError}</Typography>
       </Box>
     );
   }
   ```

**Notes:** Individual API functions in `userRequests.ts` catch network errors and return `{ success: false }` — they don't throw. The `try/catch` here covers any unexpected runtime error that escapes those guards.

---

## Step 4: Fix [17] — emailSender.ts transporter singleton

**File:** `packages/backend/src/notifications/emailSender.ts`

Move `nodemailer.createTransport(...)` to module scope, conditionally:

```ts
const transporter = notificationsEnabled
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    })
  : null;
```

Remove the `const transporter = ...` line that was inside `sendEmail()`. The existing early-return guard (`if (!notificationsEnabled || skipEmailSend)`) stays at the top of the function. The transporter is `null` when notifications are disabled, but the early-return prevents reaching `transporter.sendMail` in that case.

**Optional defensive guard:** If TypeScript infers a "possibly null" error, add `if (!transporter) return false;` after the existing early-return.

---

## Step 5: Write tests for [10] — new file

**New file:** `packages/backend/tests/unit/cron/cronTick.test.ts`

Create the `tests/unit/cron/` directory. Mock all dependencies using `vi.mock` and `vi.hoisted` before imports.

### Modules to mock

- `../../../src/db/dbAdminFunctions.js` — expose `returnCurrentWeek`, `returnPickedGames`, `upsertGameForWeek` as `vi.fn()`
- `../../../src/notifications/dispatcher.js` — expose `dispatchNotification` as `vi.fn().mockResolvedValue(undefined)`
- `../../../src/api/index.js` — expose `getGameData` as `vi.fn().mockResolvedValue([])`
- `../../../src/utils/clock.js` — expose `getNow` as `vi.fn()`
- `../../../src/utils/logger.js` — expose default with `debug`, `info`, `error`, `warn` all as `vi.fn()`
- `../../../src/cron/cronLogic.js` — expose all five exports (`shouldSendPicksReminder`, `shouldRefreshScores`, `isWeekComplete`, `getFirstKickoff`, `getLastKickoff`) as `vi.fn()`

### State isolation between tests

Because `runCronTick` uses module-level variables, use `vi.resetModules()` in `beforeEach` and dynamically re-import `runCronTick` to get a fresh module instance per test. This prevents inter-test state bleed.

### Helpers

```ts
function makeWeek(year: number, weekNumber: number) {
  return { year, weekNumber, seasonType: 'regular' as const };
}
```

### Test cases

**Test 1: first tick starts with null state**
- Mock `returnCurrentWeek` → week 2024-1, `returnPickedGames` → `[one game]`, `shouldRefreshScores` → false, others → benign
- Call `runCronTick()` once
- Assert `shouldRefreshScores` was called with `hardCapStart: null` and `lastRefreshAt: null`

**Test 2: same week does NOT reset hardCapStart**
- Tick 1: `shouldRefreshScores` returns true, `getGameData` returns `[]`, so `lastRefreshAt` gets set
- Tick 2: same week
- Assert `shouldRefreshScores` on tick 2 was called with non-null `hardCapStart`

**Test 3: week change resets hardCapStart and lastRefreshAt to null**
- Tick 1: week 2024-1, `shouldRefreshScores` returns true → sets `hardCapStart` and `lastRefreshAt`
- Tick 2: week 2024-2
- Assert `shouldRefreshScores` on tick 2 was called with `hardCapStart: null` and `lastRefreshAt: null`

---

## Step 6: Update tests for [17] — senders.test.ts

**File:** `packages/backend/tests/unit/notifications/senders.test.ts`

Add one new test inside `describe('emailSender', ...)`:

```ts
it('creates the nodemailer transporter only once, not per sendEmail call', async () => {
  const nodemailer = await import('nodemailer');
  const createTransport = vi.mocked(nodemailer.default.createTransport);

  await sendEmail({ to: 'a@example.com', subject: 'S1', htmlBody: '<p>1</p>', textBody: '1' });
  await sendEmail({ to: 'b@example.com', subject: 'S2', htmlBody: '<p>2</p>', textBody: '2' });

  expect(createTransport).toHaveBeenCalledTimes(1);
});
```

The existing `vi.mock('nodemailer', ...)` already makes `createTransport` a `vi.fn()`, so `toHaveBeenCalledTimes(1)` reflects module-load-time calls. Existing tests should pass without changes.

---

## Step 7: Write tests for [11] — new Settings component test

**New file:** `packages/frontend/tests/unit/pages/Settings.test.tsx`

Create the `tests/unit/pages/` directory.

### Missing MSW handler

`handlers.ts` currently has no handler for `GET /api/user/notifications/channels` (the `getBroadcastChannels` endpoint). Since `setup.ts` uses `onUnhandledRequest: 'error'`, tests will fail without it.

**Add to `packages/frontend/tests/mocks/handlers.ts`:**
```ts
http.get(`${API_URL}/api/user/notifications/channels`, () => {
  return HttpResponse.json({ ntfy: null, telegram: null, discord: null });
}),
```

### AuthContext wrapper

Check how `AuthContext` is exported to build a minimal wrapper:
```tsx
function renderWithAuth(ui: React.ReactElement) {
  return render(
    <AuthContext.Provider value={{
      user: { userId: 1, email: 'test@example.com', displayName: 'Test User', roles: ['user'] },
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    }}>
      {ui}
    </AuthContext.Provider>
  );
}
```
Adjust the context value shape to match the actual `AuthContext` type.

### Test 1: normal load renders notification checkboxes
- Render `<Settings />` wrapped in auth context
- Assert spinner (`role="progressbar"`) is present initially
- `waitFor` spinner to disappear
- Assert `Games Ready`, `Picks Reminder (1hr before kickoff)`, `Rankings Updated` checkboxes are present

### Test 2: API error shows error message and removes spinner
- `server.use(http.get('.../notifications/preferences', () => HttpResponse.error()))`
- Render `<Settings />`
- `waitFor` spinner to disappear
- Assert "Failed to load settings. Please refresh the page." is in the document
- Assert `Games Ready` checkbox is NOT present

**Notes:** MUI `CircularProgress` renders with `role="progressbar"`. `@testing-library/jest-dom` matchers are already available via `tests/setup.ts`.

---

## Step 8: Build verification

```bash
pnpm build
```

Fix any TypeScript errors. Common issues:
- `transporter` in `emailSender.ts` may need a null guard if TS infers `null` is possible at the `sendMail` call site.
- `loadError` state in `Settings.tsx` is `string | null` — compatible with the error branch.

---

## Step 9: Test run

```bash
pnpm test
```

All existing tests must pass. If `cronTick` tests show inter-test pollution, confirm `vi.resetModules()` is running in `beforeEach` and the import of `runCronTick` is dynamic (inside the test or `beforeEach` function, not at the top of the file).

---

## Change Summary (for history after completion)

- `packages/backend/src/cron/cronTick.ts`: added `lastWeekKey` module variable; resets `hardCapStart` and `lastRefreshAt` when active week changes.
- `packages/frontend/src/pages/Settings.tsx`: replaced `.then()`-only `useEffect` with async/await + try/finally; added `loadError` state and error UI.
- `packages/backend/src/notifications/emailSender.ts`: hoisted `nodemailer.createTransport` to module scope as a conditional singleton.
- `packages/backend/tests/unit/cron/cronTick.test.ts`: new file covering week-change state reset.
- `packages/backend/tests/unit/notifications/senders.test.ts`: added singleton assertion for `createTransport`.
- `packages/frontend/tests/unit/pages/Settings.test.tsx`: new component test covering normal load and error path.
- `packages/frontend/tests/mocks/handlers.ts`: added missing `GET /api/user/notifications/channels` default handler.
