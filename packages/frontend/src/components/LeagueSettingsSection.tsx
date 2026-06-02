import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import type { LeagueChannelConfig, LeagueMemberData } from '@shared/types/cfb-pickem-api.js';
import {
  getLeagueMembers,
  updateMemberRole,
  removeMember,
  regenerateInviteCode,
  updateLeagueName,
  getLeagueChannels,
  updateLeagueChannels,
  sendLeagueBroadcast,
} from '../apis/leagueRequests';
import { useAuth } from '../contexts/auth/AuthContext';
import { useLeague } from '../contexts/LeagueContext';

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

  const [members, setMembers] = useState<LeagueMemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regening, setRegening] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(leagueName);
  const [savingName, setSavingName] = useState(false);

  const emptyChannels: LeagueChannelConfig = {
    ntfyTopicUrl: null, telegramBotToken: null, telegramChatId: null,
    telegramInviteUrl: null, discordWebhookUrl: null, discordInviteUrl: null,
  };
  const [channels, setChannels] = useState<LeagueChannelConfig>(emptyChannels);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [savingChannels, setSavingChannels] = useState(false);
  const [channelSuccess, setChannelSuccess] = useState<string | null>(null);
  const [channelError, setChannelError] = useState<string | null>(null);

  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastOverride, setBroadcastOverride] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    getLeagueChannels(leagueId).then(res => {
      if (res.success && res.data) setChannels(res.data);
      setChannelsLoading(false);
    });
  }, [leagueId]);

  async function handleSaveChannels() {
    setSavingChannels(true);
    setChannelError(null);
    setChannelSuccess(null);
    const res = await updateLeagueChannels(leagueId, channels);
    if (res.success && res.data) {
      setChannels(res.data);
      setChannelSuccess('Channels saved.');
    } else {
      setChannelError(res.error ?? 'Failed to save channels');
    }
    setSavingChannels(false);
  }

  async function handleSendBroadcast() {
    if (!broadcastSubject.trim() || !broadcastMessage.trim()) return;
    setSendingBroadcast(true);
    setBroadcastResult(null);
    const res = await sendLeagueBroadcast(leagueId, {
      subject: broadcastSubject,
      message: broadcastMessage,
      overrideEmailPreferences: broadcastOverride,
    });
    setBroadcastResult({ success: res.success, message: res.success ? 'Message sent.' : (res.error ?? 'Failed to send') });
    if (res.success) {
      setBroadcastSubject('');
      setBroadcastMessage('');
      setBroadcastOverride(false);
    }
    setSendingBroadcast(false);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLeagueMembers(leagueId).then(result => {
      if (cancelled) return;
      if (result.success && result.data) {
        setMembers(result.data);
      } else {
        setError(result.error ?? 'Failed to load members');
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [leagueId]);

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

  async function handlePromote(userId: number) {
    setMutationError(null);
    const result = await updateMemberRole(leagueId, userId, 'admin');
    if (result.success) {
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: 'admin' } : m));
    } else {
      setMutationError(result.error ?? 'Failed to update role');
    }
  }

  async function handleDemote(userId: number) {
    setMutationError(null);
    const result = await updateMemberRole(leagueId, userId, 'member');
    if (result.success) {
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: 'member' } : m));
    } else {
      setMutationError(result.error ?? 'Failed to update role');
    }
  }

  async function handleRemove(userId: number) {
    setMutationError(null);
    const result = await removeMember(leagueId, userId);
    if (result.success) {
      setMembers(prev => prev.filter(m => m.userId !== userId));
    } else {
      setMutationError(result.error ?? 'Failed to remove member');
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

      <Typography variant="subtitle2" mb={1}>
        Members
      </Typography>

      {loading ? (
        <CircularProgress size={24} />
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map(member => (
              <TableRow key={member.userId}>
                <TableCell>
                  {member.displayName}
                  {member.userId === currentUserId && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      (you)
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={member.role === 'admin' ? 'Admin' : 'Member'}
                    size="small"
                    color={member.role === 'admin' ? 'secondary' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  {member.userId !== currentUserId && (
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {member.role === 'member' ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handlePromote(member.userId)}
                        >
                          Promote
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => handleDemote(member.userId)}
                        >
                          Demote
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleRemove(member.userId)}
                      >
                        Remove
                      </Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Notification Channels */}
      <Typography variant="h6" mb={1}>Notification Channels</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Configure push notification channels for this league. Members can subscribe to receive
        game and picks notifications.
      </Typography>
      {channelsLoading ? (
        <CircularProgress size={20} />
      ) : (
        <Stack spacing={2}>
          <TextField label="ntfy Topic URL" size="small" fullWidth value={channels.ntfyTopicUrl ?? ''} onChange={e => setChannels(c => ({ ...c, ntfyTopicUrl: e.target.value || null }))} placeholder="https://ntfy.sh/your-topic" />
          <TextField label="Telegram Bot Token" size="small" fullWidth value={channels.telegramBotToken ?? ''} onChange={e => setChannels(c => ({ ...c, telegramBotToken: e.target.value || null }))} />
          <TextField label="Telegram Chat ID" size="small" fullWidth value={channels.telegramChatId ?? ''} onChange={e => setChannels(c => ({ ...c, telegramChatId: e.target.value || null }))} />
          <TextField label="Telegram Invite URL" size="small" fullWidth value={channels.telegramInviteUrl ?? ''} onChange={e => setChannels(c => ({ ...c, telegramInviteUrl: e.target.value || null }))} placeholder="https://t.me/yourchannel" />
          <TextField label="Discord Webhook URL" size="small" fullWidth value={channels.discordWebhookUrl ?? ''} onChange={e => setChannels(c => ({ ...c, discordWebhookUrl: e.target.value || null }))} />
          <TextField label="Discord Invite URL" size="small" fullWidth value={channels.discordInviteUrl ?? ''} onChange={e => setChannels(c => ({ ...c, discordInviteUrl: e.target.value || null }))} placeholder="https://discord.gg/abc123" />
          {channelSuccess && <Alert severity="success">{channelSuccess}</Alert>}
          {channelError && <Alert severity="error">{channelError}</Alert>}
          <Box>
            <Button variant="contained" size="small" disabled={savingChannels} startIcon={savingChannels ? <CircularProgress size={16} /> : undefined} onClick={handleSaveChannels}>
              {savingChannels ? 'Saving...' : 'Save Channels'}
            </Button>
          </Box>
        </Stack>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Send Message to League */}
      <Typography variant="h6" mb={1}>Send Message to League</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Send a message to league members via email and any configured notification channels.
      </Typography>
      <Stack spacing={2}>
        <TextField label="Subject" size="small" fullWidth value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} inputProps={{ maxLength: 100 }} />
        <TextField label="Message" size="small" fullWidth multiline minRows={3} value={broadcastMessage} onChange={e => setBroadcastMessage(e.target.value)} inputProps={{ maxLength: 1000 }} />
        <FormControlLabel
          control={<Checkbox checked={broadcastOverride} onChange={e => setBroadcastOverride(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Send to all members regardless of notification preferences</Typography>}
        />
        {broadcastResult && (
          <Alert severity={broadcastResult.success ? 'success' : 'error'}>{broadcastResult.message}</Alert>
        )}
        <Box>
          <Button
            variant="contained"
            size="small"
            disabled={sendingBroadcast || !broadcastSubject.trim() || !broadcastMessage.trim()}
            startIcon={sendingBroadcast ? <CircularProgress size={16} /> : undefined}
            onClick={handleSendBroadcast}
          >
            {sendingBroadcast ? 'Sending...' : 'Send Message'}
          </Button>
        </Box>
      </Stack>

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
