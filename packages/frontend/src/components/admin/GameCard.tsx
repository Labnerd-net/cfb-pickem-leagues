import { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { type AdminDbGameDataWire, correctGameScore } from '../../apis/adminRequests';
import ScoreCorrectionDialog from './ScoreCorrectionDialog';

interface GameCardProps {
  game: AdminDbGameDataWire;
  onGameCorrected: (updated: AdminDbGameDataWire) => void;
}

export default function GameCard({ game, onGameCorrected }: GameCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          p: 2,
          border: 2,
          borderColor: 'transparent',
          position: 'relative',
        }}
      >
        {game.completed && (
          <IconButton
            size="small"
            onClick={() => setDialogOpen(true)}
            sx={{ position: 'absolute', top: 4, right: 4, color: 'text.secondary' }}
            title="Correct score"
          >
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}

        <Box>
          <Typography
            variant="h6"
            sx={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: '1.25rem',
              letterSpacing: '0.5px',
              mb: 0.5,
              pr: game.completed ? 3 : 0,
            }}
          >
            {game.awayTeam} @ {game.homeTeam}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary', fontSize: '0.875rem' }}
          >
            Week {game.weekNumber} • {game.seasonType}
          </Typography>
          {game.spread !== null && (
            <Typography
              variant="body2"
              sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary', fontSize: '0.875rem' }}
            >
              Spread: {game.spread > 0 ? `+${game.spread}` : game.spread} (home)
            </Typography>
          )}
          {game.completed && game.awayPoints !== null && game.homePoints !== null && (
            <Typography
              variant="body2"
              sx={{ fontFamily: '"Work Sans", sans-serif', color: 'primary.main', fontWeight: 600, mt: 0.5 }}
            >
              Final: {game.awayTeam} {game.awayPoints} - {game.homePoints} {game.homeTeam}
            </Typography>
          )}
        </Box>
      </Paper>

      <ScoreCorrectionDialog
        open={dialogOpen}
        game={game}
        onClose={() => setDialogOpen(false)}
        onSave={async (homePoints, awayPoints) => {
          const result = await correctGameScore(game.gameId, { homePoints, awayPoints });
          if (result.success && result.data) onGameCorrected(result.data);
          return result;
        }}
      />
    </>
  );
}
