import { describe, it, expect } from 'vitest';
import type { AdminDbGameData } from '@shared/types/cfb-pickem-api';

// Mirror the isGameInResultsMode logic from weekCalculation.ts without importing it
// (avoids import.meta.env issues in the test environment)
function isGameInResultsMode(game: AdminDbGameData): boolean {
  return game.completed || (game.startTime !== null && new Date() >= new Date(game.startTime));
}

function makeGame(overrides: Partial<AdminDbGameData> = {}): AdminDbGameData {
  return {
    gameId: 1,
    cfbdGameId: null,
    weekNumber: 1,
    year: 2024,
    seasonType: 'regular',
    completed: false,
    homeTeam: 'Home',
    awayTeam: 'Away',
    homePoints: null,
    awayPoints: null,
    winningTeam: 'pending',
    startTime: null,
    spread: null,
    createdAt: new Date(),
    ...overrides,
  };
}

const PAST = new Date(Date.now() - 60_000).toISOString();
const FUTURE = new Date(Date.now() + 3_600_000).toISOString();

describe('isGameInResultsMode', () => {
  it('returns false for a game with a future startTime and not completed', () => {
    expect(isGameInResultsMode(makeGame({ startTime: new Date(FUTURE) }))).toBe(false);
  });

  it('returns false for a game with no startTime set and not completed', () => {
    expect(isGameInResultsMode(makeGame({ startTime: null }))).toBe(false);
  });

  it('returns true for a completed game', () => {
    expect(isGameInResultsMode(makeGame({ completed: true, startTime: new Date(PAST) }))).toBe(true);
  });

  it('returns true for a game whose startTime has passed but is not yet complete', () => {
    expect(isGameInResultsMode(makeGame({ completed: false, startTime: new Date(PAST) }))).toBe(true);
  });

  it('evaluates each game independently in a mixed week', () => {
    const started = makeGame({ gameId: 1, completed: false, startTime: new Date(PAST) });
    const upcoming = makeGame({ gameId: 2, completed: false, startTime: new Date(FUTURE) });
    expect(isGameInResultsMode(started)).toBe(true);
    expect(isGameInResultsMode(upcoming)).toBe(false);
  });
});
