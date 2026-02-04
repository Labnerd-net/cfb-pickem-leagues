import axios from 'axios';
import type { NcaaScheduleOutput, NcaaScoreboardOutput } from '../types/ncaa-api.js';
import type { Classification, WeekIdData } from '@shared/types/cfb-pickem-api.js';

const ncaaAPI = 'https://ncaa-api.henrygd.me';

// ------------------------------------------------------------------
// Returns Scoreboard data from NCAA-API
// ------------------------------------------------------------------
export async function getNcaaScoreboard(
  idData: WeekIdData,
  classification: Classification = 'fbs',
  sport: string = 'football'
) {
  try {
    // path = fbs/2025/01/all-conf
    const weekTwoDigits = String(idData.week).padStart(2, '0');
    const path = `${classification}/${idData.year}/${weekTwoDigits}/all‑conf`;
    console.log(`${ncaaAPI}/scoreboard/${sport}/${path}`);
    const response = await axios.get<NcaaScoreboardOutput>(
      `${ncaaAPI}/scoreboard/${sport}/${path}`
    );
    return response.data;
  } catch (error) {
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
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
    console.error(error);
  }
}

// get /standings/{sport}/{path} // path = fbs or fbs/sec
// get /history/{path} // path = bowling/nc or basketball-women/d1
// get /rankings/{path} // path = football/fbs/associated-press
// get /brackets/{sport}/{division}/{year}
// get /news/{sport}/{division}
