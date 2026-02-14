import { client, getGames, getCalendar } from 'cfbd';
import type { DivisionClassification } from 'cfbd';
import { cfbdApiKey } from '../utils/envVars.js';
import type { Classification, WeekQuery } from '@shared/types/cfb-pickem-api.js';

// Set up the client with your API key
client.setConfig({
  headers: {
    Authorization: `Bearer ${cfbdApiKey}`,
  },
});

// ------------------------------------------------------------------
// Returns Week data from CFBD
// ------------------------------------------------------------------
export async function getCfbdWeekData(year: number) {
  const cfbdWeekData = await getCalendar({ query: { year } });
  return cfbdWeekData.data;
}

// ------------------------------------------------------------------
// Returns Game data from CFBD
// ------------------------------------------------------------------
export async function getCfbdGameData(query: WeekQuery, classification: Classification = 'fbs') {
  const cfbdClassification = returnCfbdClassification(classification);
  const cfbdGameData = await getGames({
    query: {
      year: query.year,
      classification: cfbdClassification,
      week: query.week,
      seasonType: query.seasonType,
    },
  });
  return cfbdGameData.data;
}

// ------------------------------------------------------------------
// Converts NCAA-API classification to CFBD classification
// ------------------------------------------------------------------
function returnCfbdClassification(classification: Classification): DivisionClassification {
  switch (classification) {
    case 'd1':
      return 'fbs';
    case 'd2':
      return 'ii';
    case 'd3':
      return 'iii';
    default:
      return classification;
  }
}
