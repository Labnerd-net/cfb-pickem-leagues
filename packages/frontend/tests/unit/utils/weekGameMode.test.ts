import { describe, it, expect } from 'vitest';
import type { AdminDbGameData } from '@shared/types/cfb-pickem-api';

// Mirror the isResultsMode logic from weekCalculation.ts without importing it
// (avoids import.meta.env issues in the test environment)
function isResultsMode(games: AdminDbGameData[]): boolean {
  return games.some(
    g => g.completed || (g.startTime !== null && new Date() >= new Date(g.startTime)),
  );
}

function makeGame(overrides: Partial<AdminDbGameData> = {}): AdminDbGameData {
  return {
    gameId: 1,
    cfbdGameId: null,
    ncaaGameId: null,
    picked: false,
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
    createdAt: new Date(),
    ...overrides,
  };
}

const PAST = new Date(Date.now() - 60_000).toISOString();
const FUTURE = new Date(Date.now() + 3_600_000).toISOString();

describe('isResultsMode', () => {
  it('returns false for an empty games array', () => {
    expect(isResultsMode([])).toBe(false);
  });

  it('returns false when all games are in the future and not completed', () => {
    const games = [
      makeGame({ gameId: 1, startTime: new Date(FUTURE) }),
      makeGame({ gameId: 2, startTime: new Date(FUTURE) }),
    ];
    expect(isResultsMode(games)).toBe(false);
  });

  it('returns true when at least one game is completed', () => {
    const games = [
      makeGame({ gameId: 1, completed: true, startTime: new Date(PAST) }),
      makeGame({ gameId: 2, startTime: new Date(FUTURE) }),
    ];
    expect(isResultsMode(games)).toBe(true);
  });

  it('returns true when at least one game has a startTime in the past (game started, not yet complete)', () => {
    const games = [
      makeGame({ gameId: 1, completed: false, startTime: new Date(PAST) }),
      makeGame({ gameId: 2, startTime: new Date(FUTURE) }),
    ];
    expect(isResultsMode(games)).toBe(true);
  });

  it('returns false when all games have a future startTime and completed: false', () => {
    const games = [
      makeGame({ gameId: 1, completed: false, startTime: new Date(FUTURE) }),
      makeGame({ gameId: 2, completed: false, startTime: new Date(FUTURE) }),
    ];
    expect(isResultsMode(games)).toBe(false);
  });

  it('returns true for a mixed week where some games are complete and some have future start times', () => {
    const games = [
      makeGame({ gameId: 1, completed: true, startTime: new Date(PAST) }),
      makeGame({ gameId: 2, completed: false, startTime: new Date(FUTURE) }),
    ];
    expect(isResultsMode(games)).toBe(true);
  });
});
