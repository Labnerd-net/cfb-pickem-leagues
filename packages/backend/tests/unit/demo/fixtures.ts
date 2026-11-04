import type { DemoGame, DemoGameData } from '../../../src/demo/seedData.js';
import { COMPLETED_THROUGH_WEEK, CURATION_WEEK, DEMO_YEAR } from '../../../src/demo/seedData.js';

const TEAMS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];

/** Small synthetic dataset: weeks 1..CURATION_WEEK, 3 games each, shaped like the CFBD export. */
export function makeGameData(overrides?: (g: DemoGame) => DemoGame): DemoGameData {
  const weeks = [];
  const games: DemoGame[] = [];
  for (let w = 1; w <= CURATION_WEEK; w++) {
    const start = new Date(Date.UTC(DEMO_YEAR, 7, 24 + (w - 1) * 7));
    const end = new Date(start.getTime() + 6 * 86_400_000);
    weeks.push({
      weekNumber: w,
      year: DEMO_YEAR,
      seasonType: 'regular' as const,
      weekStart: start.toISOString().slice(0, 10),
      weekEnd: end.toISOString().slice(0, 10),
    });
    const final = w <= COMPLETED_THROUGH_WEEK;
    for (let i = 0; i < 3; i++) {
      const game: DemoGame = {
        cfbdGameId: w * 100 + i,
        weekNumber: w,
        homeTeam: TEAMS[(i * 2) % TEAMS.length],
        awayTeam: TEAMS[(i * 2 + 1 + w) % TEAMS.length] === TEAMS[(i * 2) % TEAMS.length]
          ? TEAMS[(i * 2 + 3) % TEAMS.length]
          : TEAMS[(i * 2 + 1 + w) % TEAMS.length],
        startTime: new Date(start.getTime() + (5 + i) * 86_400_000 / 6).toISOString(),
        completed: final,
        homePoints: final ? 20 + i * 3 + w : null,
        awayPoints: final ? 17 + (i % 2) * 10 : null,
        spread: null,
      };
      games.push(overrides ? overrides(game) : game);
    }
  }
  return { weeks, games };
}
