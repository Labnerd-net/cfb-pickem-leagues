import { useState } from 'react';
import {
  Paper,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { AdminDbGameData } from '@shared/types/cfb-pickem-api';
import { correctGameScore } from '../../apis/adminRequests';

interface GameCardProps {
  game: AdminDbGameData;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onGameCorrected: (updated: AdminDbGameData) => void;
}

export default function GameCard({ game, selected, onSelect, onGameCorrected }: GameCardProps) {
  const isPicked = game.picked;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [homeInput, setHomeInput] = useState('');
  const [awayInput, setAwayInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  function openDialog() {
    setHomeInput(game.homePoints !== null ? String(game.homePoints) : '');
    setAwayInput(game.awayPoints !== null ? String(game.awayPoints) : '');
    setDialogError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (submitting) return;
    setDialogOpen(false);
  }

  async function handleSubmit() {
    const home = parseInt(homeInput, 10);
    const away = parseInt(awayInput, 10);
    if (!Number.isInteger(home) || home < 0 || !Number.isInteger(away) || away < 0) {
      setDialogError('Scores must be non-negative integers');
      return;
    }
    setSubmitting(true);
    setDialogError(null);
    const result = await correctGameScore(game.gameId, { homePoints: home, awayPoints: away });
    setSubmitting(false);
    if (result.success && result.data) {
      onGameCorrected(result.data);
      setDialogOpen(false);
    } else {
      setDialogError(result.error ?? 'Failed to correct score');
    }
  }

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
              onClick={e => { e.stopPropagation(); openDialog(); }}
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

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontFamily: '"Work Sans", sans-serif' }}>
          Correct Score
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, fontFamily: '"Work Sans", sans-serif' }}>
            {game.awayTeam} @ {game.homeTeam}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={`${game.awayTeam} (away)`}
              value={awayInput}
              onChange={e => setAwayInput(e.target.value)}
              type="number"
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              size="small"
              fullWidth
              disabled={submitting}
            />
            <TextField
              label={`${game.homeTeam} (home)`}
              value={homeInput}
              onChange={e => setHomeInput(e.target.value)}
              type="number"
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              size="small"
              fullWidth
              disabled={submitting}
            />
          </Box>
          {dialogError && (
            <Typography variant="body2" color="error" sx={{ mt: 1, fontFamily: '"Work Sans", sans-serif' }}>
              {dialogError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          >
            {submitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
