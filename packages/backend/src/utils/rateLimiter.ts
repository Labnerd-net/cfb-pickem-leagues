/**
 * Simple in-memory rate limiter middleware for Hono
 * Tracks requests by IP address to prevent brute force attacks
 */

import type { Context, Next } from 'hono';

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

  return async (c: Context, next: Next) => {
    // Get client IP address. Only trust forwarded headers when TRUST_PROXY=true,
    // otherwise use the raw socket address to prevent IP spoofing.
    const trustProxy = process.env.TRUST_PROXY === 'true';
    const ip = trustProxy
      ? (c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
         c.req.header('x-real-ip') ||
         c.req.header('cf-connecting-ip') ||
         'unknown')
      : ((c.req.raw as unknown as { socket?: { remoteAddress?: string } }).socket
           ?.remoteAddress ?? 'unknown');

    const now = Date.now();
    const key = `${ip}:${c.req.path}`;

    let entry = store.get(key);

    // Initialize or reset entry if window expired
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      store.set(key, entry);
    }

    entry.count++;

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', retryAfter.toString());
      return c.json(
        {
          ok: false,
          error: message,
          retryAfter,
        },
        429
      );
    }

    // Add rate limit headers
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', (maxRequests - entry.count).toString());
    c.header('X-RateLimit-Reset', new Date(entry.resetAt).toISOString());

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
