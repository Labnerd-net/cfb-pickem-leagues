import { Paper, FormControlLabel, Checkbox, Box, Typography } from '@mui/material';
import type { AdminDbGameData } from '@shared/types/cfb-pickem-api';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface GameCardProps {
  game: AdminDbGameData;
  selected: boolean;
  onSelect: (selected: boolean) => void;
}

export default function GameCard({ game, selected, onSelect }: GameCardProps) {
  const isPicked = game.picked;

  return (
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
          <Typography variant="caption" sx={{ fontFamily: '"Work Sans", sans-serif', fontWeight: 600 }}>
            PICKED
          </Typography>
        </Box>
      )}

      <FormControlLabel
        control={
          <Checkbox
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
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
  );
}
