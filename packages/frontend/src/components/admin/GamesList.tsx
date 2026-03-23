import { useState } from 'react';
import { Box } from '@mui/material';
import type { AdminDbGameData } from '@shared/types/cfb-pickem-api';
import GameCard from './GameCard';
import GameListControl from './GameListControl';

interface GamesListProps {
  games: AdminDbGameData[];
  selectedGameIds: number[];
  onGameSelect: (gameId: number, selected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSaveSelection: () => void;
  loading?: boolean;
}

export default function GamesList({
  games,
  selectedGameIds,
  onGameSelect,
  onSelectAll,
  onDeselectAll,
  onSaveSelection,
  loading = false,
}: GamesListProps) {
  const [pickedFirst, setPickedFirst] = useState(false);

  const sortedGames = pickedFirst
    ? [...games].sort((a, b) => Number(b.picked) - Number(a.picked))
    : games;

  const controlProps = {
    numOfGames: games.length,
    selectedGameIds,
    onSelectAll,
    onDeselectAll,
    onSaveSelection,
    pickedFirst,
    onTogglePickedFirst: () => setPickedFirst(prev => !prev),
    loading,
  };

  return (
    <Box>
      <GameListControl {...controlProps} />

      {/* Games Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        {sortedGames.map(game => (
          <GameCard
            key={game.gameId}
            game={game}
            selected={selectedGameIds.includes(game.gameId)}
            onSelect={selected => onGameSelect(game.gameId, selected)}
          />
        ))}
      </Box>

      <GameListControl {...controlProps} />
    </Box>
  );
}
