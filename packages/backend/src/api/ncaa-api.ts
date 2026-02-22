import axios from 'axios';
import type { NcaaScheduleOutput, NcaaScoreboardOutput } from '../types/ncaa-api.js';
import type { Classification, WeekQuery } from '@shared/types/cfb-pickem-api.js';
import logger from '../utils/logger.js';

const ncaaAPI = 'https://ncaa-api.henrygd.me';

// ------------------------------------------------------------------
// Returns Scoreboard data from NCAA-API
// ------------------------------------------------------------------
export async function getNcaaScoreboard(
  query: WeekQuery,
  classification: Classification = 'fbs',
  sport: string = 'football'
) {
  try {
    // path = fbs/2025/01/all-conf
    const weekTwoDigits = String(query.week).padStart(2, '0');
    const path = `${classification}/${query.year}/${weekTwoDigits}/all-conf`;
    const url = `${ncaaAPI}/scoreboard/${sport}/${path}`;
    logger.debug({ url }, 'NCAA scoreboard request');
    const response = await axios.get<NcaaScoreboardOutput>(url);
    return response.data;
  } catch (error) {
    logger.error({ err: error }, 'getNcaaScoreboard failed');
  }
}

// ------------------------------------------------------------------
// Returns Game data from NCAA-API
// ------------------------------------------------------------------
export async function getNcaaGame(id: number, type: string = '') {
  try {
    // type = '' or '/boxscore' '/play-by-play' '/scoring-summary'
    const response = await axios.get(`${ncaaAPI}/game/${id}${type}`);
    return response.data;
  } catch (error) {
    logger.error({ err: error }, 'getNcaaGame failed');
  }
}

// ------------------------------------------------------------------
// Returns Schedule data from NCAA-API
// ------------------------------------------------------------------
export async function getNcaaSchedule(
  year: number,
  classification: Classification = 'fbs',
  sport: string = 'football'
) {
  try {
    // path = 2025 // year only for football
    const endpoint = 'schedule-alt'; // or 'schedule'
    const response = await axios.get<NcaaScheduleOutput>(
      `${ncaaAPI}/${endpoint}/${sport}/${classification}/${year}`
    );
    return response.data;
  } catch (error) {
    logger.error({ err: error }, 'getNcaaSchedule failed');
  }
}

// ------------------------------------------------------------------
// Returns Team data from NCAA-API
// ------------------------------------------------------------------
export async function getNcaaTeams() {
  try {
    const response = await axios.get(`${ncaaAPI}/schools-index`);
    return response.data;
  } catch (error) {
    logger.error({ err: error }, 'getNcaaTeams failed');
  }
}

// ------------------------------------------------------------------
// Returns Logo data from NCAA-API
// ------------------------------------------------------------------
export async function getNcaaTeamLogo(school: string) {
  try {
    // Use the school slug or team_seo property.
    const dark = false;
    const response = await axios.get(`${ncaaAPI}/logo/${school}.svg`, {
      params: {
        dark: dark,
      },
    });
    return response.data;
  } catch (error) {
    logger.error({ err: error }, 'getNcaaTeamLogo failed');
  }
}

// ------------------------------------------------------------------
// Returns Stat data from NCAA-API
// ------------------------------------------------------------------
export async function getNcaaStats(
  year: number,
  path: string,
  classification: Classification = 'fbs',
  sport: string = 'football'
) {
  try {
    // path = team/28 or individual/20
    const response = await axios.get(`${ncaaAPI}/stats/${sport}/${classification}/${year}/${path}`);
    return response.data;
  } catch (error) {
    logger.error({ err: error }, 'getNcaaStats failed');
  }
}

// get /standings/{sport}/{path} // path = fbs or fbs/sec
// get /history/{path} // path = bowling/nc or basketball-women/d1
// get /rankings/{path} // path = football/fbs/associated-press
// get /brackets/{sport}/{division}/{year}
// get /news/{sport}/{division}
