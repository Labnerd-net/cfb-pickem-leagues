import { useState } from 'react';
import {
  Paper,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { type AdminDbGameDataWire, correctGameScore } from '../../apis/adminRequests';
import ScoreCorrectionDialog from './ScoreCorrectionDialog';

interface GameCardProps {
  game: AdminDbGameDataWire;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onGameCorrected: (updated: AdminDbGameDataWire) => void;
}

export default function GameCard({ game, selected, onSelect, onGameCorrected }: GameCardProps) {
  const isPicked = game.inLeague ?? false;
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Paper
        elevation={2}
        sx={{
          p: 2,
          border: 2,
          borderColor: selected ? 'secondary.main' : 'transparent',
          transition: 'all 0.2s',
          position: 'relative',
          '&:hover': {
            borderColor: selected ? 'secondary.main' : 'grey.300',
          },
        }}
      >
        {isPicked && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              color: 'success.main',
            }}
          >
            <CheckCircleIcon fontSize="small" />
            <Typography
              variant="caption"
              sx={{ fontFamily: '"Work Sans", sans-serif', fontWeight: 600 }}
            >
              PICKED
            </Typography>
            <IconButton
              size="small"
              onClick={e => { e.stopPropagation(); setDialogOpen(true); }}
              sx={{ ml: 0.5, color: 'text.secondary' }}
              title="Correct score"
            >
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )}

        <FormControlLabel
          control={
            <Checkbox
              checked={selected}
              onChange={e => onSelect(e.target.checked)}
              sx={{
                '& .MuiSvgIcon-root': { fontSize: 28 },
              }}
            />
          }
          label={
            <Box sx={{ ml: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: '"Bebas Neue", sans-serif',
                  fontSize: '1.25rem',
                  letterSpacing: '0.5px',
                  mb: 0.5,
                }}
              >
                {game.awayTeam} @ {game.homeTeam}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: '"Work Sans", sans-serif',
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                }}
              >
                Week {game.weekNumber} • {game.seasonType}
              </Typography>
              {game.spread !== null && (
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: '"Work Sans", sans-serif',
                    color: 'text.secondary',
                    fontSize: '0.875rem',
                  }}
                >
                  Spread: {game.spread > 0 ? `+${game.spread}` : game.spread} (home)
                </Typography>
              )}
              {game.completed && game.awayPoints !== null && game.homePoints !== null && (
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: '"Work Sans", sans-serif',
                    color: 'primary.main',
                    fontWeight: 600,
                    mt: 0.5,
                  }}
                >
                  Final: {game.awayTeam} {game.awayPoints} - {game.homePoints} {game.homeTeam}
                </Typography>
              )}
            </Box>
          }
          sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
        />
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
