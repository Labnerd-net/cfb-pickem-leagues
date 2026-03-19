# Plan for Notification Bulk Query and Rate Limiter Interval Cleanup

## Branch

`claude/fix/notification-bulk-query-rate-limit-cleanup`

---

## Steps

### Step 1: Add `returnSentNotificationUserIds` to the DB notification functions module

**File:** `packages/backend/src/db/dbNotificationFunctions.ts`

**Change:** Add a new exported async function after `hasNotificationBeenSent` (after line 189). The function accepts `year`, `weekNumber`, `notificationType`, and `channel` as parameters (no `userId`). It SELECTs only the `userId` column from `notificationLog` where all four fields match, then collects those values into a `Set<number>` and returns it. Include the same logger debug call and error-rethrow pattern used by the other functions in that file. No changes to the existing `hasNotificationBeenSent` function.

---

### Step 2: Update the email dispatch loop in the dispatcher

**File:** `packages/backend/src/notifications/dispatcher.ts`

**Change:**
1. Add `returnSentNotificationUserIds` to the named import from `../db/dbNotificationFunctions.js`.
2. Inside the email channel `try` block, before the `for` loop, call `returnSentNotificationUserIds` once with `year`, `weekNumber`, `notificationType`, and `'email'`, storing the result in a `const` (e.g., `alreadySentUserIds`).
3. Replace the `await hasNotificationBeenSent(user.userId, ...)` call inside the loop with a `alreadySentUserIds.has(user.userId)` lookup.
4. Leave broadcast channel checks (ntfy, telegram, discord) unchanged — they still call `hasNotificationBeenSent` with `BROADCAST_USER_ID`.

---

### Step 3: Store the cleanup interval handle and extend `clearRateLimitStore`

**File:** `packages/backend/src/utils/rateLimiter.ts`

**Change:**
1. Declare a module-scope `let cleanupInterval: ReturnType<typeof setInterval> | undefined` variable before the `setInterval` call.
2. Assign the return value of `setInterval(...)` to `cleanupInterval` instead of discarding it.
3. In `clearRateLimitStore`, after `store.clear()`, add `clearInterval(cleanupInterval)` and set `cleanupInterval = undefined`.

---

### Step 4: Add `clearRateLimitStore` to the rate limiter test teardown

**File:** `packages/backend/tests/unit/utils/rateLimiter.test.ts`

**Change:**
1. Add `clearRateLimitStore` to the named import from `../../../src/utils/rateLimiter.js`.
2. In each of the three `describe` blocks, add `clearRateLimitStore()` to the existing `afterEach` — cleans both the store and the interval between tests.

---

## Tests

### Test 1: `returnSentNotificationUserIds` — empty when no logs exist

**File:** `packages/backend/tests/unit/db/notificationFunctions.test.ts`

**Where:** New `describe('returnSentNotificationUserIds', ...)` block alongside the existing `addNotificationLog + hasNotificationBeenSent` block.

**What:** Call the function with a tuple that has no log rows. Assert the returned Set has `size === 0`.

---

### Test 2: `returnSentNotificationUserIds` — returns correct user IDs after logs are written

**File:** `packages/backend/tests/unit/db/notificationFunctions.test.ts`

**Where:** Same new describe block.

**What:** Insert logs for two user IDs with the same tuple and a third with a different channel. Assert the Set contains exactly the two expected IDs and not the third.

---

### Test 3: `clearRateLimitStore` clears the interval

**File:** `packages/backend/tests/unit/utils/rateLimiter.test.ts`

**Where:** New `it` case in the `general behavior` describe block.

**What:** Spy on `clearInterval` via `vi.spyOn(global, 'clearInterval')`. Call `clearRateLimitStore()`. Assert `clearInterval` was called with a non-undefined argument.

---

## Files Changed Summary

| File | Change type |
|---|---|
| `packages/backend/src/db/dbNotificationFunctions.ts` | Add `returnSentNotificationUserIds` function |
| `packages/backend/src/notifications/dispatcher.ts` | Import new function; bulk-fetch before loop; Set lookup inside loop |
| `packages/backend/src/utils/rateLimiter.ts` | Store interval handle; extend `clearRateLimitStore` |
| `packages/backend/tests/unit/db/notificationFunctions.test.ts` | Add 2 tests for new bulk query function |
| `packages/backend/tests/unit/utils/rateLimiter.test.ts` | Add `clearRateLimitStore` to all afterEach blocks; add interval-cleared test |
