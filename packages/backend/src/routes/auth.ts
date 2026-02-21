import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { setCookie, deleteCookie } from 'hono/cookie';
import * as bcrypt from 'bcryptjs';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import { ok, err } from '../utils/response.js';
import type { Credentials, JwtData, UserData } from '@shared/types/cfb-pickem-api.js';
import {
  bcryptSaltRounds,
  jwtAlgorithm,
  getJwtExpirationSeconds,
  jwtSecret,
  jwtExpirationDays,
  isProduction,
} from '../utils/envVars.js';
import { authMiddleware } from '../utils/middleware.js';
import { validatePassword } from '../utils/passwordValidation.js';
import { validateEmail } from '../utils/emailValidation.js';
import { authRateLimit } from '../utils/rateLimiter.js';
import logger from '../utils/logger.js';

type Variables = {
  jwtPayload: JwtData;
};

const auth = new Hono<{ Variables: Variables }>();

const cookieOptions = {
  httpOnly: true,
  sameSite: 'Strict' as const,
  secure: isProduction,
  path: '/',
  maxAge: jwtExpirationDays * 24 * 60 * 60,
};

// Register a new user
auth.post('/register', authRateLimit, async c => {
  try {
    const { email, password, displayName } = await c.req.json();
    if (!email || !password) {
      return c.json(err('Email and password required'), 400);
    }

    // Validate display name
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return c.json(err('Display name is required'), 400);
    }
    if (displayName.length > 50) {
      return c.json(err('Display name must be less than 50 characters'), 400);
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return c.json(err(emailValidation.error!), 400);
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json(err(passwordValidation.error!), 400);
    }

    const existing = await dbUserFunctions.returnUserByEmail(email);
    if (existing?.length) {
      return c.json(err('User already exists'), 409);
    }
    const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);
    const totalUsers = await dbUserFunctions.returnUsers();
    const roles = totalUsers.length === 0 ? ['user', 'admin'] : ['user'];
    const user = { email, passwordHash, roles, displayName: displayName.trim() } as UserData;
    const result = await dbUserFunctions.addUser(user);
    if (!result || !(result.length > 0)) {
      throw new Error(`Could not add new user with email=${email}`);
    }
    const payload = {
      sub: result[0].id,
      email: result[0].email,
      displayName: result[0].displayName,
      roles: result[0].roles,
      exp: getJwtExpirationSeconds(),
    };
    const token = await sign(payload, jwtSecret, jwtAlgorithm);
    setCookie(c, 'auth_token', token, cookieOptions);
    return c.json(ok({}));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message), 500);
    }
    logger.error({ err: e }, 'Unexpected error in auth route');
    return c.json(err('An unexpected error occurred'), 500);
  }
});

// Log in an existing user
auth.post('/login', authRateLimit, async c => {
  try {
    const { email, password }: Credentials = await c.req.json();
    if (!email || !password) {
      return c.json(err('Email and password required'), 400);
    }
    const user = await dbUserFunctions.returnUserByEmail(email);
    if (!user || user.length === 0) {
      return c.json(err('Invalid credentials'), 401);
    }
    const isValid = await bcrypt.compare(password, user[0].passwordHash);
    if (!isValid) return c.json(err('Invalid credentials'), 401);
    const payload = {
      sub: user[0].userId,
      email: user[0].email,
      displayName: user[0].displayName,
      roles: user[0].roles,
      exp: getJwtExpirationSeconds(),
    };
    const token = await sign(payload, jwtSecret, jwtAlgorithm);
    setCookie(c, 'auth_token', token, cookieOptions);
    return c.json(ok({}));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message), 500);
    }
    logger.error({ err: e }, 'Unexpected error in auth route');
    return c.json(err('An unexpected error occurred'), 500);
  }
});

// Log out — clears the auth cookie
auth.post('/logout', c => {
  deleteCookie(c, 'auth_token', { path: '/' });
  return c.json(ok({}));
});

// Return the current user's profile from the JWT cookie
auth.get('/me', authMiddleware, c => {
  const payload: JwtData = c.get('jwtPayload');
  return c.json(
    ok({
      userId: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      roles: payload.roles,
    })
  );
});

// Delete a user by ID
auth.delete('/deleteUser', authMiddleware, async c => {
  try {
    const payload = c.get('jwtPayload');
    const userIdNumber = String(payload.sub);
    const user = await dbUserFunctions.returnUserById(userIdNumber);
    if (!user || user.length === 0) {
      return c.json(err('User not found'), 404);
    }
    const returnValue = await dbUserFunctions.deleteUserById(userIdNumber);
    if (!returnValue) {
      return c.json(err('User not found'), 404);
    }
    return c.json(ok({ status: 'deleted' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message), 500);
    }
    logger.error({ err: e }, 'Unexpected error in auth route');
    return c.json(err('An unexpected error occurred'), 500);
  }
});

export default auth;
