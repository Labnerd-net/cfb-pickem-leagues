import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { jwtSecret } from './envVars.js';
import { err } from '../utils/response.js';
import type { Context, Next } from 'hono';

// ------------------------------------------------------------------
// Hash a plain‑text password (bcrypt, 12 rounds is a good default)
// ------------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

// ------------------------------------------------------------------
// Verify password against stored hash
// ------------------------------------------------------------------
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ------------------------------------------------------------------
// Create a signed JWT for a given user id
// ------------------------------------------------------------------
export function signJwt(userId: number): string {
  return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '7d' });
}

// ------------------------------------------------------------------
// Middleware for protected routes – extracts user id from Authorization header
// ------------------------------------------------------------------
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return c.json(err('Missing token', 401));
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    // Attach user id to the context for downstream handlers
    c.set('userId', payload.sub);
    await next();
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(`Invalid or expired token: ${e.message}`, 401));
    }
    console.error('Invalid or expired token:', e);
  }
}
