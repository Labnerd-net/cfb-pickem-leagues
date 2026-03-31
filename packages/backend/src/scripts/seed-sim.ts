import 'dotenv/config';
import { upsertGameForWeek, returnGamesForWeek, setPickedGames } from '../db/dbAdminFunctions.js';
import { db } from '../db/index.js';
import { adminWeeks } from '../db/schema/admin.js';
import { sql } from 'drizzle-orm';
import type { AdminGameData, AdminWeekData } from '@shared/types/cfb-pickem-api.js';

// Simulation seed — safe to run in production.
// Inserts 5 weeks of game data with kickoff times offset to start
// on the first Saturday that is >= 7 days from now, so pick deadlines
// work correctly without PICKS_IGNORE_DEADLINE.
//
// Uses year=2025 to avoid conflicting with dev seed data (year=2024).
// Run teardown-sim.ts to remove all inserted data.

const SIM_YEAR = 2025;

// Original baseline dates match seed-dev week 1.
// All game and week dates are offset by (targetSaturday - originalAnchor).
const ORIGINAL_ANCHOR = new Date('2024-08-31T00:00:00Z');

function getTargetSaturday(): Date {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = todayUtc.getUTCDay(); // 0=Sun, 6=Sat
  const daysUntilSat = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
  let candidate = new Date(todayUtc.getTime() + daysUntilSat * 86_400_000);
  // Ensure at least 7 days out so there's time to pick
  while (candidate.getTime() - todayUtc.getTime() < 7 * 86_400_000) {
    candidate = new Date(candidate.getTime() + 7 * 86_400_000);
  }
  return candidate;
}

const targetSaturday = getTargetSaturday();
const offsetMs = targetSaturday.getTime() - ORIGINAL_ANCHOR.getTime();

function shift(iso: string): Date {
  return new Date(new Date(iso).getTime() + offsetMs);
}

function shiftDateStr(iso: string): string {
  const d = shift(iso);
  return d.toISOString().slice(0, 10);
}

const WEEKS: AdminWeekData[] = [
  { weekNumber: 1, year: SIM_YEAR, seasonType: 'regular', weekStart: shiftDateStr('2024-08-24'), weekEnd: shiftDateStr('2024-08-30') },
  { weekNumber: 2, year: SIM_YEAR, seasonType: 'regular', weekStart: shiftDateStr('2024-08-31'), weekEnd: shiftDateStr('2024-09-06') },
  { weekNumber: 3, year: SIM_YEAR, seasonType: 'regular', weekStart: shiftDateStr('2024-09-07'), weekEnd: shiftDateStr('2024-09-13') },
  { weekNumber: 4, year: SIM_YEAR, seasonType: 'regular', weekStart: shiftDateStr('2024-09-14'), weekEnd: shiftDateStr('2024-09-20') },
  { weekNumber: 5, year: SIM_YEAR, seasonType: 'regular', weekStart: shiftDateStr('2024-09-21'), weekEnd: shiftDateStr('2024-09-27') },
];

function game(weekNumber: number, homeTeam: string, awayTeam: string, startTime: string): AdminGameData {
  return {
    gameId: 0,
    cfbdGameId: null,
    picked: false,
    weekNumber,
    year: SIM_YEAR,
    seasonType: 'regular',
    completed: false,
    homeTeam,
    awayTeam,
    homePoints: null,
    awayPoints: null,
    winningTeam: 'pending',
    startTime: shift(startTime),
    spread: null,
  };
}

const GAMES: AdminGameData[] = [
  // Week 1
  game(1, 'Clemson',      'Georgia',          '2024-08-31T19:30:00Z'),
  game(1, 'Georgia Tech', 'Florida State',    '2024-08-31T23:00:00Z'),
  game(1, 'Ohio State',   'Akron',            '2024-08-31T19:30:00Z'),
  game(1, 'Alabama',      'Western Kentucky', '2024-08-31T23:00:00Z'),
  game(1, 'Oregon',       'Idaho',            '2024-09-01T02:00:00Z'),
  game(1, 'Michigan',     'Fresno State',     '2024-08-31T23:00:00Z'),
  game(1, 'Notre Dame',   'Texas A&M',        '2024-08-31T16:30:00Z'),
  game(1, 'Penn State',   'West Virginia',    '2024-08-31T23:00:00Z'),

  // Week 2
  game(2, 'Georgia',       'Tennessee State',   '2024-09-07T19:30:00Z'),
  game(2, 'Florida State', 'Boston College',    '2024-09-07T19:30:00Z'),
  game(2, 'Ohio State',    'Western Michigan',  '2024-09-07T23:00:00Z'),
  game(2, 'Alabama',       'South Florida',     '2024-09-07T19:30:00Z'),
  game(2, 'Oregon',        'Boise State',       '2024-09-07T23:30:00Z'),
  game(2, 'Michigan',      'Texas',             '2024-09-07T19:30:00Z'),
  game(2, 'Notre Dame',    'Northern Illinois', '2024-09-07T19:00:00Z'),
  game(2, 'Penn State',    'Bowling Green',     '2024-09-07T19:30:00Z'),

  // Week 3
  game(3, 'Georgia',       'Tennessee Tech', '2024-09-14T19:30:00Z'),
  game(3, 'Florida State', 'Memphis',        '2024-09-14T23:00:00Z'),
  game(3, 'Ohio State',    'Marshall',       '2024-09-14T19:30:00Z'),
  game(3, 'Alabama',       'Wisconsin',      '2024-09-14T16:30:00Z'),
  game(3, 'Oregon',        'Oregon State',   '2024-09-15T02:00:00Z'),
  game(3, 'Michigan',      'Arkansas State', '2024-09-14T19:30:00Z'),
  game(3, 'Notre Dame',    'Purdue',         '2024-09-14T23:00:00Z'),
  game(3, 'Penn State',    'Kent State',     '2024-09-14T19:30:00Z'),

  // Week 4
  game(4, 'Georgia',       'Alabama',       '2024-09-21T23:30:00Z'),
  game(4, 'Florida State', 'Clemson',       '2024-09-21T19:30:00Z'),
  game(4, 'Ohio State',    'Michigan State','2024-09-21T19:30:00Z'),
  game(4, 'Texas',         'Mississippi',   '2024-09-21T19:30:00Z'),
  game(4, 'Oregon',        'UCLA',          '2024-09-21T23:00:00Z'),
  game(4, 'Michigan',      'USC',           '2024-09-21T16:30:00Z'),
  game(4, 'Notre Dame',    'Louisville',    '2024-09-21T23:30:00Z'),
  game(4, 'Penn State',    'Illinois',      '2024-09-21T19:30:00Z'),

  // Week 5
  game(5, 'Georgia',       'Auburn',        '2024-09-28T19:30:00Z'),
  game(5, 'Tennessee',     'Oklahoma',      '2024-09-28T23:30:00Z'),
  game(5, 'Ohio State',    'Iowa',          '2024-09-28T19:30:00Z'),
  game(5, 'Alabama',       'Vanderbilt',    '2024-09-28T19:30:00Z'),
  game(5, 'Oregon',        'Michigan State','2024-09-28T23:00:00Z'),
  game(5, 'Michigan',      'Minnesota',     '2024-09-28T19:30:00Z'),
  game(5, 'Notre Dame',    'Stanford',      '2024-09-29T02:00:00Z'),
  game(5, 'Penn State',    'Northwestern',  '2024-09-28T19:30:00Z'),
];

async function main() {
  console.log(`seed-sim: target Saturday = ${targetSaturday.toISOString().slice(0, 10)}`);

  console.log('seed-sim: inserting weeks…');
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
    console.log(`  week ${week.weekNumber} (${week.weekStart} → ${week.weekEnd}) ok`);
  }

  console.log('seed-sim: upserting games…');
  for (const g of GAMES) {
    await upsertGameForWeek(g);
  }
  console.log(`  ${GAMES.length} games upserted`);

  console.log('seed-sim: marking all games as picked…');
  for (const week of WEEKS) {
    const weekGames = await returnGamesForWeek({ year: SIM_YEAR, week: week.weekNumber });
    await setPickedGames({
      year: SIM_YEAR,
      week: week.weekNumber,
      games: weekGames.map(g => g.gameId),
    });
    console.log(`  week ${week.weekNumber}: ${weekGames.length} games picked`);
  }

  console.log('seed-sim: done.');
  await db.execute(sql`SELECT 1`);
  process.exit(0);
}

main().catch(err => {
  console.error('seed-sim failed:', err);
  process.exit(1);
});
