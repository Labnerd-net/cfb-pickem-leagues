import { Hono } from 'hono';
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
  const yearNumber = Number(c.req.param('year'));
  const monthNumber = Number(c.req.param('month'));
  const dayNumber = Number(c.req.param('day'));
  const sdvCfbSchedule = await getSdvCfbSchedule(yearNumber, monthNumber, dayNumber);
  return c.json(sdvCfbSchedule);
});

sdv.get('/summary/:id', async c => {
  const id = Number(c.req.param('id'));
  const sdvCfbSummary = await getSdvCfbSummary(id);
  return c.json(sdvCfbSummary);
});

sdv.get('/boxscore/:id', async c => {
  const id = Number(c.req.param('id'));
  const sdvCfbBoxScore = await getSdvCfbBoxScore(id);
  return c.json(sdvCfbBoxScore);
});

sdv.get('/scoreboard/:year/:month/:day', async c => {
  const yearNumber = Number(c.req.param('year'));
  const monthNumber = Number(c.req.param('month'));
  const dayNumber = Number(c.req.param('day'));
  const sdvCfbScoreboard = await getSdvCfbScoreboard(yearNumber, monthNumber, dayNumber);
  return c.json(sdvCfbScoreboard);
});

sdv.get('/teamlist', async c => {
  const sdvCfbTeamList = await getSdvCfbTeamList();
  return c.json(sdvCfbTeamList);
});

sdv.get('/teaminfo/:id', async c => {
  const teamId = Number(c.req.param('id'));
  const sdvCfbTeamInfo = await getSdvCfbTeamInfo(teamId);
  return c.json(sdvCfbTeamInfo);
});

export default sdv;
