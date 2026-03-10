import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { NotificationChannel, NotificationSettings, NotificationType } from '@shared/types/cfb-pickem-api.js';
import {
  getNotificationSettings,
  updateNotificationPreference,
  updateNtfyUrl,
  sendTestNtfy,
} from '../apis/userRequests';
import { resendVerificationEmail } from '../apis/authRequests';
import { useAuth } from '../contexts/auth/AuthContext';

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'games_ready', label: 'Games Ready' },
  { value: 'picks_reminder', label: 'Picks Reminder (1hr before kickoff)' },
  { value: 'rankings_updated', label: 'Rankings Updated' },
];

const CHANNELS: { value: NotificationChannel; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'ntfy', label: 'NTFY' },
];

const ntfySchema = z.object({
  ntfyServerUrl: z.string().url('Must be a valid URL').or(z.literal('')),
});

type NtfyFormValues = z.infer<typeof ntfySchema>;

function isEnabled(settings: NotificationSettings, type: NotificationType, channel: NotificationChannel): boolean {
  const pref = settings.preferences.find(p => p.notificationType === type && p.channel === channel);
  return pref ? pref.enabled : true; // default opt-in
}

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [ntfySaveStatus, setNtfySaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [ntfyTestStatus, setNtfyTestStatus] = useState<'idle' | 'sent' | 'failed'>('idle');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NtfyFormValues>({
    resolver: zodResolver(ntfySchema),
    mode: 'onBlur',
    defaultValues: { ntfyServerUrl: '' },
  });

  useEffect(() => {
    getNotificationSettings().then(res => {
      if (res.success && res.data) {
        setSettings(res.data);
        reset({ ntfyServerUrl: res.data.ntfyServerUrl ?? '' });
      }
      setLoading(false);
    });
  }, [reset]);

  const handleResend = async () => {
    const res = await resendVerificationEmail();
    setResendStatus(res.success ? 'sent' : 'error');
  };

  const handleNtfySave = async (values: NtfyFormValues) => {
    const url = values.ntfyServerUrl.trim() === '' ? null : values.ntfyServerUrl.trim();
    const res = await updateNtfyUrl(url);
    if (res.success) {
      setSettings(prev => prev ? { ...prev, ntfyServerUrl: url } : prev);
      reset({ ntfyServerUrl: url ?? '' });
      setNtfySaveStatus('saved');
    } else {
      setNtfySaveStatus('error');
    }
  };

  const handleTestNtfy = async () => {
    const res = await sendTestNtfy();
    setNtfyTestStatus(res.status === 'sent' ? 'sent' : 'failed');
  };

  const handlePrefToggle = async (type: NotificationType, channel: NotificationChannel, currentEnabled: boolean) => {
    if (!settings) return;
    const newEnabled = !currentEnabled;
    await updateNotificationPreference({ notificationType: type, channel, enabled: newEnabled });
    setSettings(prev => {
      if (!prev) return prev;
      const existing = prev.preferences.find(p => p.notificationType === type && p.channel === channel);
      if (existing) {
        return {
          ...prev,
          preferences: prev.preferences.map(p =>
            p.notificationType === type && p.channel === channel ? { ...p, enabled: newEnabled } : p
          ),
        };
      }
      return {
        ...prev,
        preferences: [...prev.preferences, { userId: 0, notificationType: type, channel, enabled: newEnabled }],
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

      {/* NTFY section */}
      <Typography variant="h6" mt={4} mb={1}>
        NTFY Notifications
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Enter your NTFY server URL to receive push notifications. Include a topic path to use your
        own topic (e.g. <code>https://ntfy.example.com/my-topic</code>), or just the server URL to
        use the default topic <code>cfb-pickem-{user?.userId}</code>. For authenticated servers,
        include the token in the URL (e.g. <code>https://:TOKEN@ntfy.example.com/my-topic</code>).
      </Typography>
      <form onSubmit={handleSubmit(handleNtfySave)}>
        <Stack spacing={2}>
          <TextField
            {...register('ntfyServerUrl')}
            label="NTFY Server URL"
            placeholder="https://ntfy.sh  or  https://:TOKEN@ntfy.example.com/my-topic"
            error={!!errors.ntfyServerUrl}
            helperText={errors.ntfyServerUrl?.message}
            fullWidth
            size="small"
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              Save
            </Button>
            <Button
              variant="outlined"
              onClick={handleTestNtfy}
              disabled={!settings?.ntfyServerUrl}
            >
              Send test notification
            </Button>
          </Stack>
          {ntfySaveStatus === 'saved' && <Typography color="success.main" variant="caption">Saved</Typography>}
          {ntfySaveStatus === 'error' && <Typography color="error" variant="caption">Save failed</Typography>}
          {ntfyTestStatus === 'sent' && <Typography color="success.main" variant="caption">Test notification sent!</Typography>}
          {ntfyTestStatus === 'failed' && <Typography color="error" variant="caption">Test notification failed</Typography>}
        </Stack>
      </form>

      {/* Notification preferences grid */}
      <Typography variant="h6" mt={4} mb={1}>
        Notification Preferences
      </Typography>
      {settings && (
        <Box>
          {NOTIFICATION_TYPES.map(({ value: type, label: typeLabel }) => (
            <Box key={type} mb={2}>
              <Typography variant="subtitle2" mb={0.5}>
                {typeLabel}
              </Typography>
              <Stack direction="row" spacing={2}>
                {CHANNELS.map(({ value: channel, label: channelLabel }) => {
                  const enabled = isEnabled(settings, type, channel);
                  const emailUnavailable = channel === 'email' && !settings.emailVerified;
                  const ntfyUnavailable = channel === 'ntfy' && !settings.ntfyServerUrl;
                  const unavailable = emailUnavailable || ntfyUnavailable;
                  const tooltipMsg = emailUnavailable
                    ? 'Verify your email to enable email notifications'
                    : ntfyUnavailable
                    ? 'Set a NTFY server URL to enable NTFY notifications'
                    : '';

                  return (
                    <Tooltip key={channel} title={unavailable ? tooltipMsg : ''} placement="top">
                      <span>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={enabled}
                              disabled={unavailable}
                              onChange={() => handlePrefToggle(type, channel, enabled)}
                            />
                          }
                          label={channelLabel}
                        />
                      </span>
                    </Tooltip>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
