import { jwt } from 'hono/jwt'
import { createMiddleware } from 'hono/factory';
import type { Context, Next } from 'hono';
import { jwtAlgorithm, jwtSecret } from '../utils/envVars.js';
import type { JwtData, Role } from '@shared/types/cfb-pickem-api.js';
import { err } from './response.js';
import pinoLogger from './logger.js';

export const logger = createMiddleware(async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  pinoLogger.info({ method: c.req.method, path: c.req.path, status: c.res.status, duration: ms });
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
