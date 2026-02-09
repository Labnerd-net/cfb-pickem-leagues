import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import * as bcrypt from 'bcryptjs';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import { ok, err } from '../utils/response.js';
import type { Credentials, JwtData, UserData } from '@shared/types/cfb-pickem-api.js';
import {
  bcryptSaltRounds,
  jwtAlgorithm,
  getJwtExpirationSeconds,
  jwtSecret,
} from '../utils/envVars.js';
import { authMiddleware } from '../utils/middleware.js';
import { validatePassword } from '../utils/passwordValidation.js';
import { authRateLimit } from '../utils/rateLimiter.js';

type Variables = {
  jwtPayload: JwtData;
};

const auth = new Hono<{ Variables: Variables }>();

// Register a new user
auth.post('/register', authRateLimit, async c => {
  try {
    const { email, password }: Credentials = await c.req.json();
    if (!email || !password) {
      return c.json(err('Email and password required'), 400);
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
    const user = { email, passwordHash, roles } as UserData;
    const result = await dbUserFunctions.addUser(user);
    if (!result || !(result.length > 0)) {
      throw new Error(`Could not add new user with email=${email}`);
    }
    const payload = {
      sub: result[0].id,
      email: result[0].email,
      roles: result[0].roles,
      exp: getJwtExpirationSeconds(),
    };
    const token = await sign(payload, jwtSecret, jwtAlgorithm);
    return c.json(ok({ token }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message), 500);
    }
    console.error('An unexpected error occurred:', e);
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
      roles: user[0].roles,
      exp: getJwtExpirationSeconds(),
    };
    const token = await sign(payload, jwtSecret, jwtAlgorithm);
    return c.json(ok({ id: user[0].userId, token }));
    // return c.json(ok({ id: user[0].userId, roles: user[0].roles, token }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message), 500);
    }
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred'), 500);
  }
});

// Delete a user by ID
auth.delete('/deleteUser', authMiddleware, async c => {
  try {
    const payload = c.get('jwtPayload');
    const user = await dbUserFunctions.returnUserById(payload.sub);
    if (!user || user.length === 0) {
      return c.json(err('User not found'), 404);
    }
    const returnValue = await dbUserFunctions.deleteUserById(payload.sub);
    if (!returnValue) {
      return c.json(err('User not found'), 404);
    }
    return c.json(ok({ status: 'deleted' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message), 500);
    }
    console.error('An unexpected error occurred:', e);
    return c.json(err('An unexpected error occurred'), 500);
  }
});

export default auth;
