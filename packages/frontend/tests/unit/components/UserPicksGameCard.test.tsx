import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserPicksGameCard from '../../../src/components/user/UserPicksGameCard.js';
import type { AdminGameWire } from '../../../src/apis/userRequests.js';

function makeGame(overrides: Partial<AdminGameWire> = {}): AdminGameWire {
  return {
    gameId: 1,
    cfbdGameId: null,
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
    spread: null,
    createdAt: '2025-08-01T00:00:00.000Z',
    ...overrides,
  };
}

const noop = vi.fn();

describe('UserPicksGameCard', () => {
  it('renders interactive radios when startTime is in the future', () => {
    const now = new Date();
    const futureTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    render(
      <UserPicksGameCard
        game={makeGame({ startTime: futureTime })}
        now={now}
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
    const now = new Date();
    const pastTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    render(
      <UserPicksGameCard
        game={makeGame({ startTime: pastTime })}
        now={now}
        onPickChange={noop}
      />
    );
    const radios = screen.getAllByRole('radio');
    radios.forEach(r => expect(r).toBeDisabled());
    expect(screen.getByText('LOCKED')).toBeInTheDocument();
    import.meta.env.VITE_IGNORE_PICK_DEADLINE = original;
  });

  it('displays formatted start time when startTime is set', () => {
    const now = new Date();
    const startTime = '2025-09-06T19:00:00.000Z';
    render(
      <UserPicksGameCard
        game={makeGame({ startTime })}
        now={now}
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
        now={new Date()}
        onPickChange={noop}
      />
    );
    expect(screen.getByText('Start time TBD')).toBeInTheDocument();
  });

  it('shows SAVED badge for non-locked game with saved pick', () => {
    const now = new Date();
    const futureTime = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    render(
      <UserPicksGameCard
        game={makeGame({ startTime: futureTime })}
        now={now}
        onPickChange={noop}
        hasSavedPick
      />
    );
    expect(screen.getByText('SAVED')).toBeInTheDocument();
    expect(screen.queryByText('LOCKED')).not.toBeInTheDocument();
  });

  describe('countdown label', () => {
    it('renders countdown when startTime is 2 hours away', () => {
      const now = new Date('2025-09-06T17:00:00.000Z');
      const startTime = '2025-09-06T19:00:00.000Z'; // 2h away
      render(
        <UserPicksGameCard
          game={makeGame({ startTime })}
          now={now}
          onPickChange={noop}
        />
      );
      expect(screen.getByText('Locks in 2 h 0 m')).toBeInTheDocument();
    });

    it('renders countdown when startTime is 30 minutes away', () => {
      const now = new Date('2025-09-06T18:30:00.000Z');
      const startTime = '2025-09-06T19:00:00.000Z'; // 30 min away
      render(
        <UserPicksGameCard
          game={makeGame({ startTime })}
          now={now}
          onPickChange={noop}
        />
      );
      expect(screen.getByText('Locks in 30 m')).toBeInTheDocument();
    });

    it('does not render countdown when startTime is null', () => {
      render(
        <UserPicksGameCard
          game={makeGame({ startTime: null })}
          now={new Date()}
          onPickChange={noop}
        />
      );
      expect(screen.queryByText(/Locks in/)).not.toBeInTheDocument();
    });

    it('does not render countdown when game is locked (past startTime)', () => {
      const now = new Date('2025-09-06T20:00:00.000Z');
      const startTime = '2025-09-06T19:00:00.000Z'; // past
      render(
        <UserPicksGameCard
          game={makeGame({ startTime })}
          now={now}
          onPickChange={noop}
        />
      );
      expect(screen.queryByText(/Locks in/)).not.toBeInTheDocument();
    });

    it('does not render countdown when VITE_IGNORE_PICK_DEADLINE is true', () => {
      const original = import.meta.env.VITE_IGNORE_PICK_DEADLINE;
      import.meta.env.VITE_IGNORE_PICK_DEADLINE = 'true';
      const now = new Date('2025-09-06T17:00:00.000Z');
      const startTime = '2025-09-06T19:00:00.000Z';
      render(
        <UserPicksGameCard
          game={makeGame({ startTime })}
          now={now}
          onPickChange={noop}
        />
      );
      expect(screen.queryByText(/Locks in/)).not.toBeInTheDocument();
      import.meta.env.VITE_IGNORE_PICK_DEADLINE = original;
    });
  });
});
