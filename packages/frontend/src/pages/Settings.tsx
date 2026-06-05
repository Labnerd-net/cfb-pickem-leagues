import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
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
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { BroadcastChannelInfo, NotificationSettings, NotificationType } from '@shared/types/cfb-pickem-api.js';
import {
  getNotificationSettings,
  getBroadcastChannels,
  updateNotificationPreference,
  updateUserProfile,
} from '../apis/userRequests';
import { resendVerificationEmail, deleteUser } from '../apis/authRequests';
import { useAuth } from '../contexts/auth/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import JoinLeagueDialog from '../components/JoinLeagueDialog';
import CreateLeagueDialog from '../components/CreateLeagueDialog';

const NOTIFICATION_TYPES: { value: Exclude<NotificationType, 'admin_broadcast'>; label: string }[] = [
  { value: 'games_ready', label: 'Games Ready' },
  { value: 'picks_reminder_1h', label: 'Picks Reminder (1hr before kickoff)' },
  { value: 'picks_reminder_24h', label: 'Picks Reminder (24hr before kickoff)' },
  { value: 'rankings_updated', label: 'Rankings Updated' },
];

function isEmailEnabled(settings: NotificationSettings, type: NotificationType): boolean {
  const pref = settings.preferences.find(p => p.notificationType === type && p.channel === 'email');
  return pref ? pref.enabled : true;
}

const displayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be 50 characters or fewer'),
});
type DisplayNameForm = z.infer<typeof displayNameSchema>;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer'),
});
type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function Settings() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  const { leagues, activeLeague, setActiveLeague, refetchLeagues } = useLeague();
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [createLeagueOpen, setCreateLeagueOpen] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [channels, setChannels] = useState<BroadcastChannelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [displayNameSuccess, setDisplayNameSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const displayNameForm = useForm<DisplayNameForm>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { displayName: user?.displayName ?? '' },
    mode: 'onBlur',
  });

  const passwordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, channelsRes] = await Promise.all([
          getNotificationSettings(),
          getBroadcastChannels(activeLeague?.leagueId),
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
  }, [activeLeague?.leagueId]);

  const handleResend = async () => {
    const res = await resendVerificationEmail();
    setResendStatus(res.success ? 'sent' : 'error');
  };

  const handlePrefToggle = async (type: Exclude<NotificationType, 'admin_broadcast'>, currentEnabled: boolean) => {
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

  const handleDisplayNameSubmit: SubmitHandler<DisplayNameForm> = async data => {
    setDisplayNameSuccess(false);
    const res = await updateUserProfile({ displayName: data.displayName });
    if (res.success) {
      await login();
      setDisplayNameSuccess(true);
      displayNameForm.reset({ displayName: data.displayName });
    } else {
      displayNameForm.setError('root', { message: res.error ?? 'Update failed' });
    }
  };

  const handlePasswordSubmit: SubmitHandler<ChangePasswordForm> = async data => {
    setPasswordSuccess(false);
    const res = await updateUserProfile({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
    if (res.success) {
      setPasswordSuccess(true);
      passwordForm.reset();
    } else {
      passwordForm.setError('root', { message: res.error ?? 'Update failed' });
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteUser();
    if (res.success) {
      await logout();
      navigate('/');
    } else {
      setDeleteError(res.error ?? 'Failed to delete account');
      setDeleting(false);
    }
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
    <Box maxWidth={600} mx="auto" mt={4} px={2} pb={8}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {/* Profile section */}
      <Typography variant="h6" mt={3} mb={2}>
        Profile
      </Typography>

      <Box
        component="form"
        onSubmit={displayNameForm.handleSubmit(handleDisplayNameSubmit)}
        sx={{ mb: 3 }}
      >
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <TextField
            label="Display Name"
            size="small"
            {...displayNameForm.register('displayName')}
            error={!!displayNameForm.formState.errors.displayName}
            helperText={displayNameForm.formState.errors.displayName?.message}
            sx={{ flex: 1 }}
          />
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={displayNameForm.formState.isSubmitting}
            sx={{ mt: '2px' }}
          >
            Save
          </Button>
        </Stack>
        {displayNameForm.formState.errors.root && (
          <Typography color="error" variant="caption" mt={0.5} display="block">
            {displayNameForm.formState.errors.root.message}
          </Typography>
        )}
        {displayNameSuccess && (
          <Typography color="success.main" variant="caption" mt={0.5} display="block">
            Display name updated.
          </Typography>
        )}
      </Box>

      <Box component="form" onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}>
        <Typography variant="subtitle2" mb={1}>
          Change Password
        </Typography>
        <Stack spacing={1.5}>
          <TextField
            label="Current Password"
            type="password"
            size="small"
            {...passwordForm.register('currentPassword')}
            error={!!passwordForm.formState.errors.currentPassword}
            helperText={passwordForm.formState.errors.currentPassword?.message}
          />
          <TextField
            label="New Password"
            type="password"
            size="small"
            {...passwordForm.register('newPassword')}
            error={!!passwordForm.formState.errors.newPassword}
            helperText={passwordForm.formState.errors.newPassword?.message}
          />
          <Box>
            <Button
              type="submit"
              variant="contained"
              size="small"
              disabled={passwordForm.formState.isSubmitting}
            >
              Change Password
            </Button>
          </Box>
        </Stack>
        {passwordForm.formState.errors.root && (
          <Typography color="error" variant="caption" mt={0.5} display="block">
            {passwordForm.formState.errors.root.message}
          </Typography>
        )}
        {passwordSuccess && (
          <Typography color="success.main" variant="caption" mt={0.5} display="block">
            Password updated.
          </Typography>
        )}
      </Box>

      {/* Leagues section */}
      <Typography variant="h6" mt={4} mb={1}>
        Leagues
      </Typography>
      {leagues.length > 0 ? (
        <Stack spacing={1} mb={2}>
          {leagues.map(l => (
            <Stack key={l.leagueId} direction="row" alignItems="center" spacing={1}>
              <Typography
                variant="body2"
                sx={{ fontWeight: l.leagueId === activeLeague?.leagueId ? 700 : 400, flex: 1 }}
              >
                {l.name}
                {l.leagueId === activeLeague?.leagueId && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    (active)
                  </Typography>
                )}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" mb={2}>
          You're not in any leagues yet.
        </Typography>
      )}
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" size="small" onClick={() => setJoinDialogOpen(true)}>
          Join another league
        </Button>
        {user?.roles.includes('admin') && (
          <Button variant="outlined" size="small" onClick={() => setCreateLeagueOpen(true)}>
            Create league
          </Button>
        )}
      </Stack>
      <JoinLeagueDialog
        open={joinDialogOpen}
        onClose={() => setJoinDialogOpen(false)}
        onJoined={refetchLeagues}
      />

      <CreateLeagueDialog
        open={createLeagueOpen}
        onClose={() => setCreateLeagueOpen(false)}
        onCreated={async newLeague => {
          await refetchLeagues();
          setActiveLeague(newLeague);
        }}
      />

      {/* Account section */}
      <Typography variant="h6" mt={4} mb={1}>
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

      <Box mt={2}>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={() => setDeleteDialogOpen(true)}
        >
          Delete Account
        </Button>
        {deleteError && (
          <Typography color="error" variant="caption" mt={0.5} display="block">
            {deleteError}
          </Typography>
        )}
      </Box>

      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete your account and all your picks. This action cannot be undone.
            If you are the sole admin of any league, you must promote another member or delete the league first.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteAccount} disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : undefined}>
            {deleting ? 'Deleting...' : 'Delete Account'}
          </Button>
        </DialogActions>
      </Dialog>

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
            Subscribe to receive notifications via these channels for{' '}
            <strong>{activeLeague?.name ?? 'your league'}</strong>. All subscribed members receive
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
