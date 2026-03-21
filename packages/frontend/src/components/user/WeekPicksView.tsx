import type { AdminGameWire } from '../../apis/userRequests';
import UserPicksGamesList from './UserPicksGamesList';

interface WeekPicksViewProps {
  games: AdminGameWire[];
  picks: Map<number, 'home_team' | 'away_team'>;
  savedPicks: Set<number>;
  onPickChange: (gameId: number, pick: 'home_team' | 'away_team') => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function WeekPicksView({
  games,
  picks,
  savedPicks,
  onPickChange,
  onSubmit,
  loading,
}: WeekPicksViewProps) {
  return (
    <UserPicksGamesList
      games={games}
      picks={picks}
      savedPicks={savedPicks}
      onPickChange={onPickChange}
      onSubmit={onSubmit}
      loading={loading}
    />
  );
}
