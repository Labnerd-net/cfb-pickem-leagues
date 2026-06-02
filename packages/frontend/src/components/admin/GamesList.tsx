import { Box } from '@mui/material';
import type { AdminDbGameDataWire } from '../../apis/adminRequests';
import GameCard from './GameCard';

interface GamesListProps {
  games: AdminDbGameDataWire[];
  onGameCorrected: (updated: AdminDbGameDataWire) => void;
}

export default function GamesList({ games, onGameCorrected }: GamesListProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        gap: 2,
        mb: 3,
      }}
    >
      {games.map(game => (
        <GameCard
          key={game.gameId}
          game={game}
          onGameCorrected={onGameCorrected}
        />
      ))}
    </Box>
  );
}
