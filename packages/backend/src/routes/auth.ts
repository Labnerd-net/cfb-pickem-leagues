import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sign } from 'hono/jwt';
import { setCookie, deleteCookie } from 'hono/cookie';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { randomBytes } from 'crypto';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import { createLeague } from '../db/dbLeagueFunctions.js';
import {
  setEmailVerificationToken,
  markEmailVerified,
} from '../db/dbNotificationFunctions.js';
import type { JwtData, UserData } from '@shared/types/cfb-pickem-api.js';
import {
  clientURLs,
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
import { sendEmail } from '../notifications/emailSender.js';
import { verifyEmailQueryValidator, registerRequestValidator, loginRequestValidator } from '../utils/zValidate.js';
import logger from '../utils/logger.js';

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
  .post('/register', authRateLimit, registerRequestValidator, async c => {
    const { email, password, displayName } = c.req.valid('json');

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) throw new HTTPException(400, { message: emailValidation.error! });

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid)
      throw new HTTPException(400, { message: passwordValidation.error! });

    const existing = await dbUserFunctions.returnUserByEmail(email);
    if (existing?.length) throw new HTTPException(409, { message: 'User already exists' });

    const passwordHash = await hashPassword(password);
    // First user ever (active + soft-deleted) gets admin. Counting both tables
    // prevents re-opening the bootstrap window if the sole admin deletes their account.
    const totalEverRegistered = await dbUserFunctions.returnTotalUserCount();
    const isFirstUser = totalEverRegistered === 0;
    const roles = isFirstUser ? ['user', 'admin'] : ['user'];
    const user = { email, passwordHash, roles, displayName: displayName.trim() } as UserData;
    const result = await dbUserFunctions.addUser(user);
    if (!result || !(result.length > 0)) {
      throw new Error(`Could not add new user with email=${email}`);
    }

    // First admin gets a Default League automatically so they're not stuck on the join prompt.
    if (isFirstUser) {
      await createLeague('Default League', result[0].userId);
    }

    // Send verification email (fire-and-forget)
    const verificationToken = randomBytes(32).toString('hex');
    setEmailVerificationToken(result[0].userId, verificationToken, new Date())
      .then(() => {
        const verifyUrl = `${clientURLs[0] ?? ''}/verify-email?token=${verificationToken}`;
        return sendEmail({
          to: email,
          subject: "Verify your CFB Pick'em email",
          htmlBody: `<p>Click <a href="${verifyUrl}">here</a> to verify your email address.</p>`,
          textBody: `Verify your email: ${verifyUrl}`,
        });
      })
      .catch(err => {
        logger.error({ err, email }, 'Failed to send verification email');
      });

    const payload = {
      sub: result[0].userId,
      email: result[0].email,
      displayName: result[0].displayName,
      roles: result[0].roles,
      emailVerified: false,
      exp: getJwtExpirationSeconds(),
    };
    const token = await sign(payload, jwtSecret, jwtAlgorithm);
    setCookie(c, 'auth_token', token, cookieOptions);
    return c.json({});
  })
  // Log in an existing user
  .post('/login', authRateLimit, loginRequestValidator, async c => {
    const { email, password } = c.req.valid('json');
    const user = await dbUserFunctions.returnUserByEmail(email);
    if (!user || user.length === 0)
      throw new HTTPException(401, { message: 'Invalid credentials' });
    const isValid = await verifyPassword(password, user[0].passwordHash);
    if (!isValid) throw new HTTPException(401, { message: 'Invalid credentials' });
    const payload = {
      sub: user[0].userId,
      email: user[0].email,
      displayName: user[0].displayName,
      roles: user[0].roles,
      emailVerified: user[0].emailVerified,
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
      emailVerified: payload.emailVerified,
    });
  })
  // Delete a user by ID
  .delete('/deleteUser', authRateLimit, authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const user = await dbUserFunctions.returnUserById(payload.sub);
    if (!user || user.length === 0) throw new HTTPException(404, { message: 'User not found' });
    await dbUserFunctions.deleteUserWithAudit(user[0]);
    return c.json({ status: 'deleted' });
  })
  // Verify email via token
  .get('/verify-email', verifyEmailQueryValidator, async c => {
    const { token } = c.req.valid('query');
    const result = await markEmailVerified(token);
    if (!result) throw new HTTPException(400, { message: 'Invalid or expired verification token' });
    return c.json({ status: 'verified' });
  })
  // Resend verification email
  .post('/resend-verification', authRateLimit, authMiddleware, async c => {
    const payload = c.get('jwtPayload');
    const verificationToken = randomBytes(32).toString('hex');
    await setEmailVerificationToken(payload.sub, verificationToken, new Date());
    const verifyUrl = `${clientURLs[0] ?? ''}/verify-email?token=${verificationToken}`;
    sendEmail({
      to: payload.email,
      subject: "Verify your CFB Pick'em email",
      htmlBody: `<p>Click <a href="${verifyUrl}">here</a> to verify your email address.</p>`,
      textBody: `Verify your email: ${verifyUrl}`,
    }).catch(err => logger.error({ err }, 'Failed to resend verification email'));
    return c.json({ status: 'sent' });
  });

export default auth;
