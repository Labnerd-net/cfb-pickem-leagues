import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { joinLeague } from '../apis/leagueRequests';

interface Props {
  open: boolean;
  onClose: () => void;
  onJoined: () => Promise<void>;
}

export default function JoinLeagueDialog({ open, onClose, onJoined }: Props) {
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (submitting) return;
    setInviteCode('');
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = inviteCode.trim();
    if (!code) return;
    setSubmitting(true);
    setError(null);
    const result = await joinLeague(code);
    if (result.success) {
      await onJoined();
      setInviteCode('');
      onClose();
    } else {
      if (result.status === 404) {
        setError('Invalid invite code. Please check and try again.');
      } else if (result.status === 409) {
        setError("You're already in this league.");
      } else {
        setError(result.error ?? 'Something went wrong. Please try again.');
      }
    }
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle
        sx={{
          fontFamily: '"Bebas Neue", cursive',
          letterSpacing: '0.05em',
          fontSize: '1.4rem',
        }}
      >
        Join a League
      </DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            label="Invite Code"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            fullWidth
            size="small"
            disabled={submitting}
            error={!!error}
            helperText={error ?? ' '}
            autoFocus
            inputProps={{ autoCapitalize: 'none' }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting || !inviteCode.trim()}
            sx={{ fontFamily: '"Work Sans", sans-serif', fontWeight: 700, textTransform: 'uppercase' }}
          >
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Join'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
