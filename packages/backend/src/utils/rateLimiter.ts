import type { Context, Next } from 'hono';
import { trustProxy } from './envVars.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Lazily started inside the first in-memory request — Workers forbids setInterval at module scope.
let cleanupInterval: ReturnType<typeof setInterval> | undefined;

function ensureCleanupInterval() {
  if (cleanupInterval !== undefined) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds (used for in-memory fallback only)
  maxRequests: number; // Maximum requests per window (used for in-memory fallback only)
  message?: string; // Custom error message
}

/**
 * Rate limiting middleware factory.
 *
 * When a `bindingKey` is provided and `c.env[bindingKey]` resolves to a
 * Cloudflare Workers RateLimit binding, the native binding handles counting
 * (no KV operations). Falls back to an in-memory store when the binding is
 * absent (local dev / tests).
 */
export function rateLimit(config: RateLimitConfig, bindingKey?: string) {
  const { windowMs, maxRequests, message = 'Too many requests, please try again later' } = config;

  return async (c: Context, next: Next) => {
    const rateLimiter = bindingKey
      ? ((c.env as Record<string, unknown> | undefined)?.[bindingKey] as
          | { limit(opts: { key: string }): Promise<{ success: boolean }> }
          | undefined)
      : undefined;

    const ip = trustProxy
      ? (c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
          c.req.header('x-real-ip') ||
          c.req.header('cf-connecting-ip') ||
          'unknown')
      : ((c.req.raw as unknown as { socket?: { remoteAddress?: string } }).socket?.remoteAddress ??
          c.req.header('cf-connecting-ip') ??
          'unknown');

    const key = `${ip}:${c.req.path}`;

    if (rateLimiter) {
      const { success } = await rateLimiter.limit({ key });
      if (!success) {
        return c.json({ ok: false, error: message }, 429);
      }
    } else {
      // Local dev / test path: in-memory store
      ensureCleanupInterval();
      const now = Date.now();
      let entry = store.get(key);
      if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + windowMs };
        store.set(key, entry);
      }
      entry.count++;
      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        c.header('Retry-After', retryAfter.toString());
        return c.json({ ok: false, error: message, retryAfter }, 429);
      }
      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', (maxRequests - entry.count).toString());
      c.header('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());
    }

    await next();
  };
}

/**
 * Preset: Strict rate limit for authentication endpoints
 * 5 attempts per 60 seconds — enforced via AUTH_RATE_LIMITER binding in production.
 */
export const authRateLimit = rateLimit(
  {
    windowMs: 60 * 1000,
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
  },
  'AUTH_RATE_LIMITER',
);

/**
 * Preset: Moderate rate limit for general API endpoints
 * 100 requests per 60 seconds — enforced via API_RATE_LIMITER binding in production.
 */
export const apiRateLimit = rateLimit(
  {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Too many requests. Please try again later.',
  },
  'API_RATE_LIMITER',
);

/**
 * Clear the rate limit store and stop the cleanup interval.
 * For use in tests and graceful shutdown hooks.
 */
export function clearRateLimitStore(): void {
  store.clear();
  clearInterval(cleanupInterval);
  cleanupInterval = undefined;
}
