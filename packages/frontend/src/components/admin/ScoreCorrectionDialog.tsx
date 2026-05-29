import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

export interface ScoreCorrectionGame {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
}

interface ScoreCorrectionDialogProps {
  open: boolean;
  game: ScoreCorrectionGame;
  onClose: () => void;
  onSave: (homePoints: number, awayPoints: number) => Promise<{ success: boolean; error?: string }>;
}

export default function ScoreCorrectionDialog({
  open,
  game,
  onClose,
  onSave,
}: ScoreCorrectionDialogProps) {
  const [homeInput, setHomeInput] = useState(() =>
    game.homePoints !== null ? String(game.homePoints) : ''
  );
  const [awayInput, setAwayInput] = useState(() =>
    game.awayPoints !== null ? String(game.awayPoints) : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  function handleClose() {
    if (submitting) return;
    onClose();
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
    const result = await onSave(home, away);
    setSubmitting(false);
    if (result.success) {
      onClose();
    } else {
      setDialogError(result.error ?? 'Failed to correct score');
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: '"Work Sans", sans-serif' }}>Correct Score</DialogTitle>
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
          <Typography
            variant="body2"
            color="error"
            sx={{ mt: 1, fontFamily: '"Work Sans", sans-serif' }}
          >
            {dialogError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
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
  );
}
