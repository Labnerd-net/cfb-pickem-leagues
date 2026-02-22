import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { setCookie, deleteCookie } from 'hono/cookie';
import * as bcrypt from 'bcryptjs';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
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

type Variables = {
  jwtPayload: JwtData;
};

const cookieOptions = {
  httpOnly: true,
  sameSite: 'Strict' as const,
  secure: isProduction,
  path: '/',
  maxAge: jwtExpirationDays * 24 * 60 * 60,
};

const auth = new Hono<{ Variables: Variables }>()
  // Register a new user
  .post('/register', authRateLimit, async c => {
    const { email, password, displayName } = await c.req.json();
    if (!email || !password)
      throw new HTTPException(400, { message: 'Email and password required' });
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0)
      throw new HTTPException(400, { message: 'Display name is required' });
    if (displayName.length > 50)
      throw new HTTPException(400, { message: 'Display name must be less than 50 characters' });

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid)
      throw new HTTPException(400, { message: emailValidation.error! });

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid)
      throw new HTTPException(400, { message: passwordValidation.error! });

    const existing = await dbUserFunctions.returnUserByEmail(email);
    if (existing?.length) throw new HTTPException(409, { message: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);
    const totalUsers = await dbUserFunctions.returnUsers();
    const roles = totalUsers.length === 0 ? ['user', 'admin'] : ['user'];
    const user = { email, passwordHash, roles, displayName: displayName.trim() } as UserData;
    const result = await dbUserFunctions.addUser(user);
    if (!result || !(result.length > 0)) {
      throw new Error(`Could not add new user with email=${email}`);
    }
    const payload = {
      sub: result[0].userId,
      email: result[0].email,
      displayName: result[0].displayName,
      roles: result[0].roles,
      exp: getJwtExpirationSeconds(),
    };
    const token = await sign(payload, jwtSecret, jwtAlgorithm);
    setCookie(c, 'auth_token', token, cookieOptions);
    return c.json({});
  })
  // Log in an existing user
  .post('/login', authRateLimit, async c => {
    const { email, password }: Credentials = await c.req.json();
    if (!email || !password)
      throw new HTTPException(400, { message: 'Email and password required' });
    const user = await dbUserFunctions.returnUserByEmail(email);
    if (!user || user.length === 0)
      throw new HTTPException(401, { message: 'Invalid credentials' });
    const isValid = await bcrypt.compare(password, user[0].passwordHash);
    if (!isValid) throw new HTTPException(401, { message: 'Invalid credentials' });
    const payload = {
      sub: user[0].userId,
      email: user[0].email,
      displayName: user[0].displayName,
      roles: user[0].roles,
      exp: getJwtExpirationSeconds(),
    };
    const token = await sign(payload, jwtSecret, jwtAlgorithm);
    setCookie(c, 'auth_token', token, cookieOptions);
    return c.json({});
  })
  // Log out — clears the auth cookie
  .post('/logout', c => {
    deleteCookie(c, 'auth_token', { path: '/' });
    return c.json({});
  })
  // Return the current user's profile from the JWT cookie
  .get('/me', authMiddleware, c => {
    const payload: JwtData = c.get('jwtPayload');
    return c.json({
      userId: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      roles: payload.roles,
    });
  })
  // Delete a user by ID
  .delete('/deleteUser', authRateLimit, authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const user = await dbUserFunctions.returnUserById(payload.sub);
    if (!user || user.length === 0)
      throw new HTTPException(404, { message: 'User not found' });
    const returnValue = await dbUserFunctions.deleteUserById(payload.sub);
    if (!returnValue) throw new HTTPException(404, { message: 'User not found' });
    return c.json({ status: 'deleted' });
  });

export default auth;
