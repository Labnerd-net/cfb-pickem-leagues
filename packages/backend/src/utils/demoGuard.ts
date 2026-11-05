import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { demoMode } from './envVars.js';
import { DEMO_ADMIN_USER_ID, DEMO_USER_USER_ID } from '../demo/seedData.js';

// Guard for the public demo deployment. Everything here is inert unless DEMO_MODE is on
// (only the isolated demo Worker sets it), so production behavior is unchanged.
//
// Admin routes (/api/admin/*) are DENY BY DEFAULT: a route works in the demo only if it is
// listed in DEMO_ADMIN_ALLOWED. DEMO_ADMIN_BLOCKED documents the routes that exist today and
// are deliberately blocked; a test fails if a registered admin route is in neither list, so a
// newly added admin route has to be classified before it can be merged.

export interface RouteRule {
  method: string;
  path: string;
}

export const DEMO_ADMIN_ALLOWED: RouteRule[] = [
  { method: 'GET', path: '/api/admin/users' },
  { method: 'GET', path: '/api/admin/weeks' },
  { method: 'GET', path: '/api/admin/games' },
  { method: 'PATCH', path: '/api/admin/games/:gameId/score' },
  { method: 'GET', path: '/api/admin/notification-logs' },
  { method: 'GET', path: '/api/admin/leagues/:leagueId/games' },
  { method: 'POST', path: '/api/admin/leagues/:leagueId/games/:gameId' },
  { method: 'DELETE', path: '/api/admin/leagues/:leagueId/games/:gameId' },
];

export const DEMO_ADMIN_BLOCKED: RouteRule[] = [
  { method: 'PATCH', path: '/api/admin/users/:id/roles' },
  { method: 'PATCH', path: '/api/admin/users/:id/password' },
  { method: 'POST', path: '/api/admin/year/:year' },
  { method: 'DELETE', path: '/api/admin/year/:year' },
  { method: 'POST', path: '/api/admin/week' },
  { method: 'POST', path: '/api/admin/weeks/sync-results' },
  { method: 'POST', path: '/api/admin/notifications/test' },
  { method: 'GET', path: '/api/admin/users/export' },
  { method: 'POST', path: '/api/admin/notifications/broadcast' },
];

// Explicit blocks outside /api/admin. Everything else outside /api/admin is allowed.
const BLOCKED_OTHER: RouteRule[] = [
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/resend-verification' },
  { method: 'DELETE', path: '/api/auth/deleteUser' },
  { method: 'PATCH', path: '/api/user/profile' },
  { method: 'DELETE', path: '/api/leagues/:leagueId' },
  { method: 'PATCH', path: '/api/leagues/:leagueId/channels' },
  { method: 'POST', path: '/api/leagues/:leagueId/broadcast' },
];

// Member role changes and removals are blocked only when they target a shared demo account,
// so visitors cannot demote, remove, or lock out the accounts everyone signs in with.
// The demo accounts have fixed IDs that survive every reset, so no lookup is needed.
const DEMO_ACCOUNT_IDS = new Set([DEMO_ADMIN_USER_ID, DEMO_USER_USER_ID]);
const MEMBER_ROUTE = /^\/api\/leagues\/[^/]+\/members\/([^/]+)$/;

const MESSAGE = 'This action is disabled in the demo.';

function toRegex(pattern: string): RegExp {
  return new RegExp(`^${pattern.replace(/:[A-Za-z]+/g, '[^/]+')}$`);
}

function compile(rules: RouteRule[]) {
  return rules.map(r => ({ method: r.method, re: toRegex(r.path) }));
}

const allowedAdmin = compile(DEMO_ADMIN_ALLOWED);
const blockedOther = compile(BLOCKED_OTHER);

function matches(rules: { method: string; re: RegExp }[], method: string, path: string): boolean {
  return rules.some(r => r.method === method && r.re.test(path));
}

/**
 * Returns the 403 message if the request must be blocked in demo mode, or null if allowed.
 * Pure (does not read the demo flag) so it can be unit tested directly.
 */
export function demoBlockReason(rawMethod: string, rawPath: string): string | null {
  // Hono serves HEAD with the GET handler, so classify it as GET.
  const method = rawMethod === 'HEAD' ? 'GET' : rawMethod;
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;

  if (path === '/api/admin' || path.startsWith('/api/admin/')) {
    return matches(allowedAdmin, method, path) ? null : MESSAGE;
  }
  if (matches(blockedOther, method, path)) return MESSAGE;

  if (method === 'PATCH' || method === 'DELETE') {
    const member = MEMBER_ROUTE.exec(path);
    if (member && DEMO_ACCOUNT_IDS.has(Number(member[1]))) {
      return 'The shared demo accounts cannot be changed or removed.';
    }
  }
  return null;
}

export const demoGuard = createMiddleware(async (c, next) => {
  if (!demoMode || c.req.method === 'OPTIONS') return next();
  const reason = demoBlockReason(c.req.method, c.req.path);
  if (reason) throw new HTTPException(403, { message: reason });
  await next();
});

// For routes that exist only in the demo (e.g. demo-login). Answers exactly like an
// unregistered route, so production behaves as if the route does not exist.
export const demoOnly = createMiddleware(async (c, next) => {
  if (!demoMode) return c.json({ message: 'Not Found' }, 404);
  await next();
});
