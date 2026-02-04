import { Hono } from 'hono';
import { ok, err } from '../utils/response.js';
import {
  getSdvCfbSchedule,
  getSdvCfbScoreboard,
  getSdvCfbTeamList,
  getSdvCfbTeamInfo,
  getSdvCfbSummary,
  getSdvCfbBoxScore,
} from '../api/sdv.js';

const sdv = new Hono();

sdv.get('/schedule/:year/:month/:day', async c => {
  try {
    const yearNumber = Number(c.req.param('year'));
    const monthNumber = Number(c.req.param('month'));
    const dayNumber = Number(c.req.param('day'));
    const sdvCfbSchedule = await getSdvCfbSchedule(yearNumber, monthNumber, dayNumber);
    return c.json(ok(sdvCfbSchedule));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

sdv.get('/summary/:id', async c => {
  try {
    const id = Number(c.req.param('id'));
    const sdvCfbTeamInfo = await getSdvCfbSummary(id);
    return c.json(ok(sdvCfbTeamInfo));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

sdv.get('/boxscore/:id', async c => {
  try {
    const id = Number(c.req.param('id'));
    const sdvCfbTeamInfo = await getSdvCfbBoxScore(id);
    return c.json(ok(sdvCfbTeamInfo));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

sdv.get('/scoreboard/:year/:month/:day', async c => {
  try {
    const yearNumber = Number(c.req.param('year'));
    const monthNumber = Number(c.req.param('month'));
    const dayNumber = Number(c.req.param('day'));
    const sdvCfbScoreboard = await getSdvCfbScoreboard(yearNumber, monthNumber, dayNumber);
    return c.json(ok(sdvCfbScoreboard));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

sdv.get('/teamlist', async c => {
  try {
    const sdvCfbTeamList = await getSdvCfbTeamList();
    return c.json(ok(sdvCfbTeamList));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

sdv.get('/teaminfo/:id', async c => {
  try {
    const teamId = Number(c.req.param('id'));
    const sdvCfbTeamInfo = await getSdvCfbTeamInfo(teamId);
    return c.json(ok(sdvCfbTeamInfo));
  } catch (e: unknown) {
    if (e instanceof Error) {
      return c.json(err(e.message, 500));
    }
    console.error('An unexpected error occurred:', e);
  }
});

export default sdv;
