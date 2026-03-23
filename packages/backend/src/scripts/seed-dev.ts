import 'dotenv/config';
import { upsertGameForWeek, returnGamesForWeek, setPickedGames } from '../db/dbAdminFunctions.js';
import { db } from '../db/index.js';
import { adminWeeks } from '../db/schema/admin.js';
import { sql } from 'drizzle-orm';
import type { AdminGameData, AdminWeekData } from '@shared/types/cfb-pickem-api.js';

if (process.env.NODE_ENV === 'production') {
  console.error('seed-dev: refused to run in production');
  process.exit(1);
}

const SEED_YEAR = 2024;

const WEEKS: AdminWeekData[] = [
  { weekNumber: 1, year: SEED_YEAR, seasonType: 'regular', weekStart: '2024-08-24', weekEnd: '2024-08-30' },
  { weekNumber: 2, year: SEED_YEAR, seasonType: 'regular', weekStart: '2024-08-31', weekEnd: '2024-09-06' },
  { weekNumber: 3, year: SEED_YEAR, seasonType: 'regular', weekStart: '2024-09-07', weekEnd: '2024-09-13' },
];

function game(
  weekNumber: number,
  homeTeam: string,
  awayTeam: string,
  startTime: string
): AdminGameData {
  return {
    gameId: 0,
    cfbdGameId: null,
    picked: false,
    weekNumber,
    year: SEED_YEAR,
    seasonType: 'regular',
    completed: false,
    homeTeam,
    awayTeam,
    homePoints: null,
    awayPoints: null,
    winningTeam: 'pending',
    startTime: new Date(startTime),
    spread: null,
  };
}

const GAMES: AdminGameData[] = [
  // Week 1 — August 31, 2024
  game(1, 'Clemson',       'Georgia',         '2024-08-31T19:30:00Z'),
  game(1, 'Georgia Tech',  'Florida State',   '2024-08-31T23:00:00Z'),
  game(1, 'Ohio State',    'Akron',           '2024-08-31T19:30:00Z'),
  game(1, 'Alabama',       'Western Kentucky','2024-08-31T23:00:00Z'),
  game(1, 'Oregon',        'Idaho',           '2024-09-01T02:00:00Z'),
  game(1, 'Michigan',      'Fresno State',    '2024-08-31T23:00:00Z'),
  game(1, 'Notre Dame',    'Texas A&M',       '2024-08-31T16:30:00Z'),
  game(1, 'Penn State',    'West Virginia',   '2024-08-31T23:00:00Z'),

  // Week 2 — September 7, 2024
  game(2, 'Georgia',        'Tennessee State', '2024-09-07T19:30:00Z'),
  game(2, 'Florida State',  'Boston College',  '2024-09-07T19:30:00Z'),
  game(2, 'Ohio State',     'Western Michigan','2024-09-07T23:00:00Z'),
  game(2, 'Alabama',        'South Florida',   '2024-09-07T19:30:00Z'),
  game(2, 'Oregon',         'Boise State',     '2024-09-07T23:30:00Z'),
  game(2, 'Michigan',       'Texas',           '2024-09-07T19:30:00Z'),
  game(2, 'Notre Dame',     'Northern Illinois','2024-09-07T19:00:00Z'),
  game(2, 'Penn State',     'Bowling Green',   '2024-09-07T19:30:00Z'),

  // Week 3 — September 14, 2024
  game(3, 'Georgia',        'Tennessee Tech',  '2024-09-14T19:30:00Z'),
  game(3, 'Florida State',  'Memphis',         '2024-09-14T23:00:00Z'),
  game(3, 'Ohio State',     'Marshall',        '2024-09-14T19:30:00Z'),
  game(3, 'Alabama',        'Wisconsin',       '2024-09-14T16:30:00Z'),
  game(3, 'Oregon',         'Oregon State',    '2024-09-15T02:00:00Z'),
  game(3, 'Michigan',       'Arkansas State',  '2024-09-14T19:30:00Z'),
  game(3, 'Notre Dame',     'Purdue',          '2024-09-14T23:00:00Z'),
  game(3, 'Penn State',     'Kent State',      '2024-09-14T19:30:00Z'),
];

async function main() {
  console.log('seed-dev: inserting weeks…');
  for (const week of WEEKS) {
    await db
      .insert(adminWeeks)
      .values({
        weekNumber: week.weekNumber,
        year: week.year,
        seasonType: week.seasonType,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
      })
      .onConflictDoNothing();
    console.log(`  week ${week.weekNumber} ok`);
  }

  console.log('seed-dev: upserting games…');
  for (const g of GAMES) {
    await upsertGameForWeek(g);
  }
  console.log(`  ${GAMES.length} games upserted`);

  console.log('seed-dev: marking all games as picked…');
  for (const week of WEEKS) {
    const weekGames = await returnGamesForWeek({ year: SEED_YEAR, week: week.weekNumber });
    await setPickedGames({
      year: SEED_YEAR,
      week: week.weekNumber,
      games: weekGames.map(g => g.gameId),
    });
    console.log(`  week ${week.weekNumber}: ${weekGames.length} games picked`);
  }

  console.log('seed-dev: done.');
  await db.execute(sql`SELECT 1`); // flush any pending writes
  process.exit(0);
}

main().catch(err => {
  console.error('seed-dev failed:', err);
  process.exit(1);
});
