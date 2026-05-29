import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { LeagueData } from '@shared/types/cfb-pickem-api.js';
import { createLeague } from '../apis/leagueRequests';

interface CreateLeagueDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (league: LeagueData) => void;
}

export default function CreateLeagueDialog({ open, onClose, onCreated }: CreateLeagueDialogProps) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdLeague, setCreatedLeague] = useState<(LeagueData & { inviteCode: string }) | null>(null);
  const [copied, setCopied] = useState(false);

  function handleClose() {
    if (submitting) return;
    setName('');
    setNameError(null);
    setSubmitError(null);
    setCreatedLeague(null);
    setCopied(false);
    onClose();
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('League name is required');
      return;
    }
    if (trimmed.length > 80) {
      setNameError('League name must be 80 characters or fewer');
      return;
    }
    setNameError(null);
    setSubmitError(null);
    setSubmitting(true);
    const result = await createLeague(trimmed);
    setSubmitting(false);
    if (result.success && result.data) {
      setCreatedLeague(result.data);
      onCreated(result.data);
    } else {
      setSubmitError(result.error ?? 'Failed to create league');
    }
  }

  async function handleCopy() {
    if (!createdLeague?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(createdLeague.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: '"Work Sans", sans-serif' }}>Create League</DialogTitle>
      <DialogContent>
        {createdLeague ? (
          <Box>
            <Typography variant="body1" sx={{ mb: 2, fontFamily: '"Work Sans", sans-serif' }}>
              League <strong>{createdLeague.name}</strong> created! Share this invite code with players:
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                component="code"
                sx={{
                  fontFamily: 'monospace',
                  px: 1.5,
                  py: 0.5,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  fontSize: '1rem',
                }}
              >
                {createdLeague.inviteCode}
              </Typography>
              <Tooltip title={copied ? 'Copied!' : 'Copy invite code'}>
                <IconButton size="small" onClick={handleCopy}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ pt: 1 }}>
            <TextField
              label="League Name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              fullWidth
              size="small"
              error={!!nameError}
              helperText={nameError}
              disabled={submitting}
              inputProps={{ maxLength: 80 }}
            />
            {submitError && (
              <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
                {submitError}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          {createdLeague ? 'Close' : 'Cancel'}
        </Button>
        {!createdLeague && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          >
            {submitting ? 'Creating...' : 'Create'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
