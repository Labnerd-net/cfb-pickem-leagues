import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { BroadcastChannelInfo, NotificationSettings, NotificationType } from '@shared/types/cfb-pickem-api.js';
import {
  getNotificationSettings,
  getBroadcastChannels,
  updateNotificationPreference,
} from '../apis/userRequests';
import { resendVerificationEmail } from '../apis/authRequests';
import { useAuth } from '../contexts/auth/AuthContext';

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'games_ready', label: 'Games Ready' },
  { value: 'picks_reminder', label: 'Picks Reminder (1hr before kickoff)' },
  { value: 'rankings_updated', label: 'Rankings Updated' },
];

function isEmailEnabled(settings: NotificationSettings, type: NotificationType): boolean {
  const pref = settings.preferences.find(p => p.notificationType === type && p.channel === 'email');
  return pref ? pref.enabled : true;
}

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [channels, setChannels] = useState<BroadcastChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');

  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, channelsRes] = await Promise.all([
          getNotificationSettings(),
          getBroadcastChannels(),
        ]);
        if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data);
        if (channelsRes.success && channelsRes.data) setChannels(channelsRes.data);
      } catch {
        setLoadError('Failed to load settings. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleResend = async () => {
    const res = await resendVerificationEmail();
    setResendStatus(res.success ? 'sent' : 'error');
  };

  const handlePrefToggle = async (type: NotificationType, currentEnabled: boolean) => {
    if (!settings) return;
    const newEnabled = !currentEnabled;
    await updateNotificationPreference({ notificationType: type, channel: 'email', enabled: newEnabled });
    setSettings(prev => {
      if (!prev) return prev;
      const existing = prev.preferences.find(p => p.notificationType === type && p.channel === 'email');
      if (existing) {
        return {
          ...prev,
          preferences: prev.preferences.map(p =>
            p.notificationType === type && p.channel === 'email' ? { ...p, enabled: newEnabled } : p
          ),
        };
      }
      return {
        ...prev,
        preferences: [...prev.preferences, { userId: 0, notificationType: type, channel: 'email', enabled: newEnabled }],
      };
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <Typography color="error">{loadError}</Typography>
      </Box>
    );
  }

  const hasBroadcastChannels = channels && (channels.ntfy || channels.telegram || channels.discord);

  return (
    <Box maxWidth={600} mx="auto" mt={4} px={2}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {/* Account section */}
      <Typography variant="h6" mt={3} mb={1}>
        Account
      </Typography>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography>{user?.email}</Typography>
        {settings?.emailVerified ? (
          <Chip label="Verified" color="success" size="small" />
        ) : (
          <>
            <Chip label="Unverified" color="warning" size="small" />
            <Button
              size="small"
              variant="outlined"
              onClick={handleResend}
              disabled={resendStatus === 'sent'}
            >
              {resendStatus === 'sent' ? 'Email sent' : 'Resend verification email'}
            </Button>
            {resendStatus === 'error' && (
              <Typography color="error" variant="caption">Failed to resend</Typography>
            )}
          </>
        )}
      </Stack>

      {/* Email notification preferences */}
      <Typography variant="h6" mt={4} mb={1}>
        Email Notifications
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Choose which events trigger email notifications. Requires a verified email address.
      </Typography>
      {settings && (
        <Box>
          {NOTIFICATION_TYPES.map(({ value: type, label: typeLabel }) => {
            const enabled = isEmailEnabled(settings, type);
            const unavailable = !settings.emailVerified;

            return (
              <Tooltip
                key={type}
                title={unavailable ? 'Verify your email to enable email notifications' : ''}
                placement="top"
              >
                <span>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={enabled}
                        disabled={unavailable}
                        onChange={() => handlePrefToggle(type, enabled)}
                      />
                    }
                    label={typeLabel}
                  />
                </span>
              </Tooltip>
            );
          })}
        </Box>
      )}

      {/* Broadcast channels */}
      {hasBroadcastChannels && (
        <>
          <Typography variant="h6" mt={4} mb={1}>
            Push Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Subscribe to receive notifications via these channels. All subscribed members receive
            the same broadcast when games are posted, picks are due, or rankings are updated.
          </Typography>
          <Stack spacing={2}>
            {channels.ntfy && (
              <Box>
                <Typography variant="subtitle2">ntfy</Typography>
                <Typography variant="body2" color="text.secondary">
                  Subscribe to the topic in the{' '}
                  <Link href="https://ntfy.sh" target="_blank" rel="noopener noreferrer">
                    ntfy app
                  </Link>{' '}
                  using the URL below.
                </Typography>
                <Typography
                  variant="body2"
                  component="code"
                  sx={{ display: 'inline-block', mt: 0.5, px: 1, py: 0.25, bgcolor: 'action.hover', borderRadius: 1, wordBreak: 'break-all' }}
                >
                  {channels.ntfy.topicUrl}
                </Typography>
              </Box>
            )}
            {channels.telegram && (
              <Box>
                <Typography variant="subtitle2">Telegram</Typography>
                <Typography variant="body2" color="text.secondary">
                  Join the Telegram group or channel to receive notifications.
                </Typography>
                {channels.telegram.inviteUrl ? (
                  <Link href={channels.telegram.inviteUrl} target="_blank" rel="noopener noreferrer" variant="body2">
                    Join on Telegram
                  </Link>
                ) : (
                  <Typography variant="body2" color="text.secondary" fontStyle="italic">
                    Ask your admin for the Telegram invite link.
                  </Typography>
                )}
              </Box>
            )}
            {channels.discord && (
              <Box>
                <Typography variant="subtitle2">Discord</Typography>
                <Typography variant="body2" color="text.secondary">
                  Join the Discord server to receive notifications in the configured channel.
                </Typography>
                {channels.discord.inviteUrl ? (
                  <Link href={channels.discord.inviteUrl} target="_blank" rel="noopener noreferrer" variant="body2">
                    Join on Discord
                  </Link>
                ) : (
                  <Typography variant="body2" color="text.secondary" fontStyle="italic">
                    Ask your admin for the Discord invite link.
                  </Typography>
                )}
              </Box>
            )}
          </Stack>
        </>
      )}
    </Box>
  );
}
