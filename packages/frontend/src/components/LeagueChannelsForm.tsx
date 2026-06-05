import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import type { LeagueChannelConfig } from '@shared/types/cfb-pickem-api.js';
import { getLeagueChannels, updateLeagueChannels } from '../apis/leagueRequests';

interface LeagueChannelsFormProps {
  leagueId: number;
}

const emptyChannels: LeagueChannelConfig = {
  ntfyTopicUrl: null, telegramBotToken: null, telegramChatId: null,
  telegramInviteUrl: null, discordWebhookUrl: null, discordInviteUrl: null,
};

export default function LeagueChannelsForm({ leagueId }: LeagueChannelsFormProps) {
  const [channels, setChannels] = useState<LeagueChannelConfig>(emptyChannels);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getLeagueChannels(leagueId).then(res => {
      if (res.success && res.data) setChannels(res.data);
      setLoading(false);
    });
  }, [leagueId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const res = await updateLeagueChannels(leagueId, channels);
    if (res.success && res.data) {
      setChannels(res.data);
      setSuccess('Channels saved.');
    } else {
      setError(res.error ?? 'Failed to save channels');
    }
    setSaving(false);
  }

  return (
    <Box>
      <Typography variant="h6" mb={1}>Notification Channels</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Configure push notification channels for this league. Members can subscribe to receive
        game and picks notifications.
      </Typography>
      {loading ? (
        <CircularProgress size={20} />
      ) : (
        <Stack spacing={2}>
          <TextField label="ntfy Topic URL" size="small" fullWidth value={channels.ntfyTopicUrl ?? ''} onChange={e => setChannels(c => ({ ...c, ntfyTopicUrl: e.target.value || null }))} placeholder="https://ntfy.sh/your-topic" />
          <TextField label="Telegram Bot Token" size="small" fullWidth value={channels.telegramBotToken ?? ''} onChange={e => setChannels(c => ({ ...c, telegramBotToken: e.target.value || null }))} />
          <TextField label="Telegram Chat ID" size="small" fullWidth value={channels.telegramChatId ?? ''} onChange={e => setChannels(c => ({ ...c, telegramChatId: e.target.value || null }))} />
          <TextField label="Telegram Invite URL" size="small" fullWidth value={channels.telegramInviteUrl ?? ''} onChange={e => setChannels(c => ({ ...c, telegramInviteUrl: e.target.value || null }))} placeholder="https://t.me/yourchannel" />
          <TextField label="Discord Webhook URL" size="small" fullWidth value={channels.discordWebhookUrl ?? ''} onChange={e => setChannels(c => ({ ...c, discordWebhookUrl: e.target.value || null }))} />
          <TextField label="Discord Invite URL" size="small" fullWidth value={channels.discordInviteUrl ?? ''} onChange={e => setChannels(c => ({ ...c, discordInviteUrl: e.target.value || null }))} placeholder="https://discord.gg/abc123" />
          {success && <Alert severity="success">{success}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          <Box>
            <Button variant="contained" size="small" disabled={saving} startIcon={saving ? <CircularProgress size={16} /> : undefined} onClick={handleSave}>
              {saving ? 'Saving...' : 'Save Channels'}
            </Button>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
