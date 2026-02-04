import { Hono } from 'hono';
import * as dbAdminFunctions from '../db/dbAdminFunctions.js';
import { getWeekData, getGameData } from '../api/index.js';
import { ok, err } from '../utils/response.js';
import type { AdminDbGameData, PickedGamesData, WeekIdData } from '@shared/types/cfb-pickem-api.js'

const admin = new Hono();

// Add Weeks to Year
admin.post('/year/:year', async c => {
  try {
    const yearNumber = Number(c.req.param('year'));
    const weekData = await getWeekData(yearNumber);
    console.log(weekData);
    if (weekData?.length) {
      await Promise.all(weekData.map(week => dbAdminFunctions.addWeek(week)));
    }
    return c.json(ok({ status: 'added all weeks' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

// Add Games to Week
admin.post('/week', async c => {
  try {
    const pickedData: WeekIdData = await c.req.json();
    const gameData = await getGameData(pickedData);
    if (gameData?.length) {
      await Promise.all(gameData.map(game => dbAdminFunctions.addGameToWeek(game)));
    }
    return c.json(ok({ status: 'added all games' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

// Get Games for Week
admin.post('/getgames', async c => {
  try {
    const pickedData: WeekIdData = await c.req.json();
    const weekGames = await dbAdminFunctions.returnGamesForWeek(pickedData);
    if (!weekGames || weekGames.length === 0) {
      return c.json(err('No games found for this week', 404));
    }
    return c.json(ok({ weekGames }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

// Get all picked games
admin.post('/getpicked', async c => {
  try {
    const pickedData: WeekIdData = await c.req.json();
    const pickedGames: AdminDbGameData[] = await dbAdminFunctions.returnPickedGames(pickedData);
    if (!pickedGames || pickedGames.length === 0) {
      return c.json(err('No picked games found for this week', 404));
    }
    return c.json(ok({ pickedGames }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

// Set picked games
admin.post('/setpicks', async c => {
  try {
    const pickedData: PickedGamesData = await c.req.json();
    console.log(JSON.stringify(pickedData));
    await dbAdminFunctions.setPickedGame(pickedData.games);
    return c.json(ok({ status: 'updated picked games' }));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

export default admin;
