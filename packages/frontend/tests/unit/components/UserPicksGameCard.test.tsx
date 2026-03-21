import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserPicksGameCard from '../../../src/components/user/UserPicksGameCard.js';
import type { AdminGameWire } from '../../../src/apis/userRequests.js';

function makeGame(overrides: Partial<AdminGameWire> = {}): AdminGameWire {
  return {
    gameId: 1,
    cfbdGameId: null,
    ncaaGameId: 'ncaa-1',
    picked: true,
    weekNumber: 1,
    year: 2025,
    seasonType: 'regular',
    completed: false,
    homeTeam: 'Home Team',
    awayTeam: 'Away Team',
    homePoints: null,
    awayPoints: null,
    winningTeam: 'pending',
    startTime: null,
    createdAt: '2025-08-01T00:00:00.000Z',
    ...overrides,
  };
}

const noop = vi.fn();

describe('UserPicksGameCard', () => {
  it('renders interactive radios when startTime is in the future', () => {
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    render(
      <UserPicksGameCard
        game={makeGame({ startTime: futureTime })}
        onPickChange={noop}
      />
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    radios.forEach(r => expect(r).not.toBeDisabled());
  });

  it('renders disabled radios and LOCKED badge when startTime is in the past', () => {
    const original = import.meta.env.VITE_IGNORE_PICK_DEADLINE;
    import.meta.env.VITE_IGNORE_PICK_DEADLINE = 'false';
    const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    render(
      <UserPicksGameCard
        game={makeGame({ startTime: pastTime })}
        onPickChange={noop}
      />
    );
    const radios = screen.getAllByRole('radio');
    radios.forEach(r => expect(r).toBeDisabled());
    expect(screen.getByText('LOCKED')).toBeInTheDocument();
    import.meta.env.VITE_IGNORE_PICK_DEADLINE = original;
  });

  it('displays formatted start time when startTime is set', () => {
    const startTime = '2025-09-06T19:00:00.000Z';
    render(
      <UserPicksGameCard
        game={makeGame({ startTime })}
        onPickChange={noop}
      />
    );
    // The exact locale string varies by environment, but it should contain year/month/day info
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it('displays "Start time TBD" when startTime is null', () => {
    render(
      <UserPicksGameCard
        game={makeGame({ startTime: null })}
        onPickChange={noop}
      />
    );
    expect(screen.getByText('Start time TBD')).toBeInTheDocument();
  });

  it('shows SAVED badge for non-locked game with saved pick', () => {
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    render(
      <UserPicksGameCard
        game={makeGame({ startTime: futureTime })}
        onPickChange={noop}
        hasSavedPick
      />
    );
    expect(screen.getByText('SAVED')).toBeInTheDocument();
    expect(screen.queryByText('LOCKED')).not.toBeInTheDocument();
  });
});
