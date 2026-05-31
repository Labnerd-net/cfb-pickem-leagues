import type { Context, Next } from 'hono';
import { trustProxy } from './envVars.js';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting (use Redis in production for distributed systems)
const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes to prevent memory leaks
let cleanupInterval: ReturnType<typeof setInterval> | undefined = setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom error message
}

/**
 * Rate limiting middleware factory
 * @param config - Rate limit configuration
 * @returns Hono middleware function
 */
export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, message = 'Too many requests, please try again later' } = config;
  const windowSec = Math.ceil(windowMs / 1000);

  return async (c: Context, next: Next) => {
    const kv = (c.env as { RATE_LIMIT_KV?: KVNamespace } | undefined)?.RATE_LIMIT_KV;

    // Get client IP address. Only trust forwarded headers when TRUST_PROXY=true,
    // otherwise use the raw socket address to prevent IP spoofing.
    // In Workers, cf-connecting-ip is always the real client IP.
    const ip = trustProxy
      ? (c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
         c.req.header('x-real-ip') ||
         c.req.header('cf-connecting-ip') ||
         'unknown')
      : ((c.req.raw as unknown as { socket?: { remoteAddress?: string } }).socket
           ?.remoteAddress ?? c.req.header('cf-connecting-ip') ?? 'unknown');

    const now = Date.now();
    const key = `rl:${ip}:${c.req.path}`;

    if (kv) {
      // Workers path: KV-backed rate limiting
      const stored = await kv.get(key);
      const entry: RateLimitEntry = stored
        ? JSON.parse(stored)
        : { count: 0, resetAt: now + windowMs };

      if (entry.resetAt < now) {
        entry.count = 0;
        entry.resetAt = now + windowMs;
      }

      entry.count++;
      await kv.put(key, JSON.stringify(entry), { expirationTtl: windowSec });

      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        c.header('Retry-After', retryAfter.toString());
        return c.json({ ok: false, error: message, retryAfter }, 429);
      }

      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', (maxRequests - entry.count).toString());
      c.header('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());
    } else {
      // Local dev path: in-memory store
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
 * Clear the rate limit store and stop the cleanup interval.
 * For use in tests and graceful shutdown hooks.
 */
export function clearRateLimitStore(): void {
  store.clear();
  clearInterval(cleanupInterval);
  cleanupInterval = undefined;
}

/**
 * Preset: Strict rate limit for authentication endpoints
 * 5 attempts per 15 minutes
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

/**
 * Preset: Moderate rate limit for general API endpoints
 * 100 requests per 15 minutes
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests. Please try again later.',
});
