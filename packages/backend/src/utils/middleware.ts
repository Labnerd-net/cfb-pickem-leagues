import { jwt } from 'hono/jwt'
import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import { jwtAlgorithm, jwtSecret } from '../utils/envVars.js';
import type { JwtData, Role } from '@shared/types/cfb-pickem-api.js';
import { err } from './response.js';

export const logger = createMiddleware(async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`);
  await next();
});   

// Middleware for routes requiring login
export const authMiddleware = jwt({
  secret: jwtSecret,
  alg: jwtAlgorithm,
})   

// Middleware for routes requiring a specific role
export const requireRole = (role: Role) => {
  return async (c: Context, next: Next) => {
    const payload: JwtData = c.get('jwtPayload')
    if (!payload || !payload.roles.includes(role)) {
      return c.json(err('Forbidden', 403))
    }
    await next()
  }
}
