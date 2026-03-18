# Plan: Email XSS and Rate Limiter IP Spoofing Fix

## Context
Two high-severity security fixes from backlog [2] and [3]:
- [2] `rankingsUpdatedTemplate` interpolates `e.displayName` directly into email HTML with no escaping — stored XSS delivered to all opted-in users.
- [3] Rate limiter trusts `x-forwarded-for` unconditionally — any client can spoof their IP to bypass `authRateLimit` (5 attempts/15 min).

## Files to Modify

| File | Change |
|------|--------|
| `packages/backend/src/notifications/templates.ts` | Add `escapeHtml()` helper; apply to `displayName` in `rankingsUpdatedTemplate` |
| `packages/backend/src/utils/rateLimiter.ts` | Conditionally use socket IP vs proxy headers based on `TRUST_PROXY` |
| `packages/backend/src/utils/envVars.ts` | Add `export const trustProxy` |
| `packages/backend/.env.example` (or docs) | Document `TRUST_PROXY` env var |
| `packages/backend/tests/unit/notifications/templates.test.ts` | New test file |
| `packages/backend/tests/unit/utils/rateLimiter.test.ts` | New test file |

Note: `CLAUDE.md` documents env vars inline — update the env var table there.

## Step-by-Step Implementation

### 1. `escapeHtml` utility in `templates.ts`

Add a private helper at the top of the file (not exported — only needed here):

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

Apply in `rankingsUpdatedTemplate` only for `e.displayName`:
```typescript
return `<tr><td>${i + 1}</td><td>${escapeHtml(e.displayName)}</td><td>${e.correct}/${e.total}</td><td>${pct}</td></tr>`;
```

No changes to `gamesReadyTemplate` or `picksReminderTemplate` — both use only numeric/Date values, no user-controlled strings.

### 2. `TRUST_PROXY` env var in `envVars.ts`

Add after the existing boolean-style vars (following the same `=== 'true'` pattern):
```typescript
export const trustProxy = process.env.TRUST_PROXY === 'true';
```

### 3. Rate limiter IP resolution in `rateLimiter.ts`

Import `trustProxy` from envVars. Replace the current unconditional header lookup:

```typescript
import { trustProxy } from './envVars.js';

// inside rateLimit():
const ip = trustProxy
  ? (c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
     c.req.header('x-real-ip') ||
     c.req.header('cf-connecting-ip') ||
     'unknown')
  : ((c.req.raw as any).socket?.remoteAddress || 'unknown');
```

The `(c.req.raw as any)` cast is needed because `c.req.raw` is typed as `Request` in Hono's generic types but is actually `IncomingMessage` under `@hono/node-server`. This is a known pattern in this runtime.

### 4. Tests

**`tests/unit/notifications/templates.test.ts`** — pure function tests, no mocking needed:
- `rankingsUpdatedTemplate` with XSS display name → assert `htmlBody` contains escaped entities, not raw `<script>`
- `rankingsUpdatedTemplate` with normal display name → assert output unchanged
- `rankingsUpdatedTemplate` with `&` in display name → assert `&amp;`

**`tests/unit/utils/rateLimiter.test.ts`** — mock Hono context:
- Helper to build a mock `Context` with configurable `x-forwarded-for` header and socket address
- `TRUST_PROXY=false`: spoofed `x-forwarded-for` header does not affect rate limit key (socket address used)
- `TRUST_PROXY=true`: `x-forwarded-for` IS used as rate limit key
- Normal behavior: window/count/limit enforcement still works

Use `vi.hoisted` + `vi.mock` to control `trustProxy` value between tests (same pattern as `senders.test.ts`).

### 5. Document env var

In `CLAUDE.md` (under Environment Variables), add `TRUST_PROXY=false` with a comment explaining it.

## Verification

1. `pnpm build` — no TypeScript errors
2. `pnpm test:backend` — new template and rate limiter tests pass, existing suite unaffected
3. Manual: set display name to `<b>bold</b>` and trigger a rankings notification in dev — email body should show `&lt;b&gt;bold&lt;/b&gt;`
4. Manual: with `TRUST_PROXY=false` (default), confirm auth rate limit applies to actual socket IP, not spoofed header
