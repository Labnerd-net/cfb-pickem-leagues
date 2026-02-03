import { Hono } from 'hono';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import { hashPassword, verifyPassword, signJwt } from '../utils/auth.js';
import type { UserFormData } from '../types/data.js';
import { ok, err } from '../utils/response.js';

const auth = new Hono();

// Register a new user
auth.post('/register', async c => {
  try {
    const { email, password }: UserFormData = await c.req.json();
    if (!email || !password) {
      return c.json(err('Email and password required', 400));
    }
    const existing = await dbUserFunctions.returnUserByEmail(email);
    if (existing?.length) {
      return c.json(err('User already exists', 409));
    }
    const passwordHash = await hashPassword(password);
    const result = await dbUserFunctions.addUser(email, passwordHash);
    if (!result || !(result.length > 0)) {
      throw new Error(`Could not add new user with email=${email}`);
    }
    const token = signJwt(result[0].id);
    return c.json(ok({ token }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

// Log in an existing user
auth.post('/login', async c => {
  try {
    const { email, password }: UserFormData = await c.req.json();
    if (!email || !password) {
      return c.json(err('Email and password required', 400));
    }
    const user = await dbUserFunctions.returnUserByEmail(email);
    if (!user || user.length === 0) {
      return c.json(err('Invalid credentials', 401));
    }
    const isValid = await verifyPassword(password, user[0].password_hash);
    if (!isValid) {
      return c.json(err('Invalid credentials', 401));
    }
    const token = signJwt(user[0].user_id);
    return c.json(ok({ id: user[0].user_id, isAdmin: user[0].is_admin, token }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

// Delete a user by ID
auth.delete('/:userId', async c => {
  try {
    const userId = c.req.param('userId');
    const user = await dbUserFunctions.returnUserById(userId);
    if (!user || user.length === 0) {
      return c.json(err('User not found', 404));
    }
    const returnValue = await dbUserFunctions.deleteUserById(userId);
    if (!returnValue) {
      return c.json(err('User not found', 404));
    }
    console.log(returnValue);
    return c.json(ok({ status: 'deleted' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

export default auth;
