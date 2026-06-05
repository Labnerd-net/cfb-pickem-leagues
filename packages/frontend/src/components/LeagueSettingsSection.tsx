import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import { regenerateInviteCode, updateLeagueName } from '../apis/leagueRequests';
import { useAuth } from '../contexts/auth/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import LeagueMembersTable from './LeagueMembersTable';
import LeagueChannelsForm from './LeagueChannelsForm';
import LeagueBroadcastForm from './LeagueBroadcastForm';

interface LeagueSettingsSectionProps {
  leagueId: number;
  leagueName: string;
  inviteCode?: string;
  onInviteCodeChange: (newCode: string) => void;
  onNameChange?: (newName: string) => void;
}

export default function LeagueSettingsSection({
  leagueId,
  leagueName,
  inviteCode,
  onInviteCodeChange,
  onNameChange,
}: LeagueSettingsSectionProps) {
  const { user } = useAuth();
  const { refetchLeagues } = useLeague();
  const currentUserId = user?.userId;

  const [mutationError, setMutationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regening, setRegening] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(leagueName);
  const [savingName, setSavingName] = useState(false);

  async function handleCopyInviteCode() {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  }

  async function handleCopyInviteLink() {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  }

  async function handleSaveName() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === leagueName) { setEditingName(false); return; }
    setSavingName(true);
    const result = await updateLeagueName(leagueId, trimmed);
    setSavingName(false);
    if (result.success) {
      setEditingName(false);
      onNameChange?.(trimmed);
      await refetchLeagues();
    } else {
      setMutationError(result.error ?? 'Failed to rename league');
    }
  }

  async function handleRegenerate() {
    setRegening(true);
    const result = await regenerateInviteCode(leagueId);
    setRegening(false);
    setRegenDialogOpen(false);
    if (result.success && result.data) {
      onInviteCodeChange(result.data);
      await refetchLeagues();
    } else {
      setMutationError(result.error ?? 'Failed to regenerate invite code');
    }
  }

  return (
    <Box>
      {editingName ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <TextField
            size="small"
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
            autoFocus
            inputProps={{ maxLength: 80 }}
          />
          <Button size="small" variant="contained" onClick={handleSaveName} disabled={savingName || !nameValue.trim()}>
            {savingName ? <CircularProgress size={16} /> : 'Save'}
          </Button>
          <Button size="small" onClick={() => { setEditingName(false); setNameValue(leagueName); }} disabled={savingName}>
            Cancel
          </Button>
        </Stack>
      ) : (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">{leagueName}</Typography>
          <Tooltip title="Rename league">
            <IconButton size="small" onClick={() => { setNameValue(leagueName); setEditingName(true); }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}

      {inviteCode && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" mb={0.5}>
            Invite Code
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
                fontSize: '0.95rem',
              }}
            >
              {inviteCode}
            </Typography>
            <Tooltip title={copied ? 'Copied!' : 'Copy invite code'}>
              <IconButton size="small" onClick={handleCopyInviteCode}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={copiedLink ? 'Copied!' : 'Copy invite link'}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={handleCopyInviteLink}
              >
                {copiedLink ? 'Copied!' : 'Copy link'}
              </Button>
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={() => setRegenDialogOpen(true)}
            >
              Regenerate
            </Button>
          </Stack>
        </Box>
      )}

      {mutationError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMutationError(null)}>
          {mutationError}
        </Alert>
      )}

      <LeagueMembersTable leagueId={leagueId} currentUserId={currentUserId} />

      <Divider sx={{ my: 3 }} />

      <LeagueChannelsForm leagueId={leagueId} />

      <Divider sx={{ my: 3 }} />

      <LeagueBroadcastForm leagueId={leagueId} />

      <Dialog open={regenDialogOpen} onClose={() => !regening && setRegenDialogOpen(false)}>
        <DialogTitle>Regenerate Invite Code?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The current invite code will be invalidated. Anyone who has not yet joined using it
            will need the new code.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenDialogOpen(false)} disabled={regening}>
            Cancel
          </Button>
          <Button
            color="warning"
            variant="contained"
            disabled={regening}
            startIcon={regening ? <CircularProgress size={16} /> : undefined}
            onClick={handleRegenerate}
          >
            {regening ? 'Regenerating...' : 'Regenerate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
