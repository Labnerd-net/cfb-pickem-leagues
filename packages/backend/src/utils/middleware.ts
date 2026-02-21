import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { Context, Next } from 'hono';
import { jwtAlgorithm, jwtSecret } from '../utils/envVars.js';
import type { JwtData, Role } from '@shared/types/cfb-pickem-api.js';
import pinoLogger from './logger.js';

export const logger = createMiddleware(async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  pinoLogger.info({ method: c.req.method, path: c.req.path, status: c.res.status, duration: ms });
});

// Middleware for routes requiring login — reads JWT from httpOnly cookie
export const authMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, 'auth_token');
  if (!token) throw new HTTPException(401, { message: 'Unauthorized' });
  try {
    const payload = await verify(token, jwtSecret, jwtAlgorithm);
    c.set('jwtPayload', payload as unknown as JwtData);
    await next();
  } catch {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
});

// Middleware for routes requiring a specific role
export const requireRole = (role: Role) => {
  return async (c: Context, next: Next) => {
    const payload: JwtData = c.get('jwtPayload');
    if (!payload || !payload.roles.includes(role)) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    await next();
  };
};
