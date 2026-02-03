import { Hono } from 'hono';
import * as dbUserFunctions from '../db/dbUserFunctions.js';
import { authMiddleware } from '../utils/auth.js';
import type { AllUserGamePicks } from '../types/data.js';
import { ok, err } from '../utils/response.js';

const user = new Hono();

// Show user info
user.get('/:userId', authMiddleware, async c => {
  try {
    const userId = c.req.param('userId');
    const user = await dbUserFunctions.returnUserById(userId);
    if (!user || user.length !== 1) {
      return c.json(err('User not found', 404));
    }
    return c.json(ok({ id: user[0].user_id, email: user[0].email, isAdmin: user[0].is_admin }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

// Set user game picks
user.post('/picks', authMiddleware, async c => {
  try {
    const userPicks: AllUserGamePicks = await c.req.json();
    for (const pick of userPicks.games) {
      await dbUserFunctions.addPickedGame(pick);
    }
    return c.json(ok({ status: 'updated picked games' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

export default user;
