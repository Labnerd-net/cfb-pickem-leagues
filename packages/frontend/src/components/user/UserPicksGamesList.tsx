import { Box, Button, Typography, CircularProgress } from '@mui/material';
import type { AdminGameWire } from '../../apis/userRequests';
import UserPicksGameCard from './UserPicksGameCard';

interface UserPicksGamesListProps {
  games: AdminGameWire[];
  picks: Map<number, 'home_team' | 'away_team'>;
  savedPicks: Set<number>;
  onPickChange: (gameId: number, pick: 'home_team' | 'away_team') => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function UserPicksGamesList({
  games,
  picks,
  savedPicks,
  onPickChange,
  onSubmit,
  loading,
}: UserPicksGamesListProps) {
  const pickCount = picks.size;
  const totalGames = games.length;
  const hasNoPicks = pickCount === 0;

  return (
    <Box>
      {/* Games Grid */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        {games.map(game => (
          <UserPicksGameCard
            key={game.gameId}
            game={game}
            selectedTeam={picks.get(game.gameId)}
            onPickChange={onPickChange}
            hasSavedPick={savedPicks.has(game.gameId)}
          />
        ))}
      </Box>

      {/* Submit Controls */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          p: 2,
          backgroundColor: 'background.paper',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Typography
          sx={{
            fontFamily: '"Work Sans", sans-serif',
            color: 'text.secondary',
            fontSize: '0.875rem',
          }}
        >
          {pickCount} of {totalGames} games picked
        </Typography>

        <Button
          variant="contained"
          color="primary"
          onClick={onSubmit}
          disabled={hasNoPicks || loading}
          sx={{
            minWidth: { xs: '100%', sm: 200 },
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '1.1rem',
            letterSpacing: '0.5px',
          }}
        >
          {loading ? (
            <>
              <CircularProgress size={20} sx={{ mr: 1, color: 'inherit' }} />
              Submitting...
            </>
          ) : (
            'Submit All Picks'
          )}
        </Button>
      </Box>
    </Box>
  );
}
