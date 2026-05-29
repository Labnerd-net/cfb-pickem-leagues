import { useState } from 'react';
import { Box, Button, CircularProgress, TextField, Typography, Paper, alpha, useTheme } from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import { joinLeague } from '../apis/leagueRequests';

interface Props {
  onJoined: () => Promise<void>;
}

export default function JoinLeaguePrompt({ onJoined }: Props) {
  const theme = useTheme();
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = inviteCode.trim();
    if (!code) return;
    setSubmitting(true);
    setError(null);
    const result = await joinLeague(code);
    if (result.success) {
      await onJoined();
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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        px: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 5,
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          border: `2px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            border: `2px solid ${theme.palette.secondary.main}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
          }}
        >
          <SportsFootballIcon sx={{ color: 'common.white', fontSize: 32 }} />
        </Box>

        <Typography
          variant="h5"
          sx={{
            fontFamily: '"Bebas Neue", cursive',
            letterSpacing: '0.05em',
            mb: 1,
          }}
        >
          You're not in any league yet
        </Typography>
        <Typography
          sx={{
            fontFamily: '"Work Sans", sans-serif',
            color: 'text.secondary',
            mb: 3,
            fontSize: '0.95rem',
          }}
        >
          Enter an invite code to join a league and start picking games.
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Invite Code"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            fullWidth
            size="small"
            disabled={submitting}
            error={!!error}
            helperText={error ?? ' '}
            sx={{ mb: 2 }}
            inputProps={{ autoCapitalize: 'none' }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={submitting || !inviteCode.trim()}
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              py: 1.2,
            }}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Join League'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
