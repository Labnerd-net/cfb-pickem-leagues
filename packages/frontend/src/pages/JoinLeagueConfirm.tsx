import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router';
import { Box, Button, CircularProgress, Typography, Paper, Stack, Alert } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import { useAuth } from '../contexts/auth/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import { getLeagueByInviteCodePublic, joinLeague } from '../apis/leagueRequests';

export default function JoinLeagueConfirm() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { leagues, setActiveLeague, refetchLeagues } = useLeague();

  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    getLeagueByInviteCodePublic(inviteCode).then(result => {
      if (result.success && result.data) {
        setLeagueName(result.data.leagueName);
        if (leagues.some(l => l.leagueId === result.data!.leagueId)) {
          setAlreadyMember(true);
        }
      } else {
        setFetchError('This invite link is no longer valid.');
      }
      setFetchLoading(false);
    });
  }, [inviteCode, leagues]);

  const handleJoin = async () => {
    if (!inviteCode) return;
    setJoining(true);
    setJoinError(null);
    const result = await joinLeague(inviteCode);
    if (result.success && result.data) {
      await refetchLeagues();
      setActiveLeague(result.data);
      navigate('/dashboard', { replace: true });
    } else if (result.status === 409) {
      setAlreadyMember(true);
    } else {
      setJoinError(result.error ?? 'Failed to join league. Please try again.');
    }
    setJoining(false);
  };

  const loading = fetchLoading || authLoading;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Paper elevation={3} sx={{ maxWidth: 480, width: '100%', p: 4, textAlign: 'center' }}>
        {loading ? (
          <CircularProgress />
        ) : fetchError ? (
          <Stack spacing={2} alignItems="center">
            <Typography variant="h6" fontFamily='"Work Sans", sans-serif' color="error">
              Link Not Valid
            </Typography>
            <Typography variant="body2" color="text.secondary" fontFamily='"Work Sans", sans-serif'>
              {fetchError}
            </Typography>
            <Button component={RouterLink} to="/" variant="outlined" size="small">
              Go Home
            </Button>
          </Stack>
        ) : (
          <Stack spacing={3} alignItems="center">
            <GroupsIcon sx={{ fontSize: 48, color: 'primary.main' }} />
            <Box>
              <Typography variant="body2" color="text.secondary" fontFamily='"Work Sans", sans-serif' mb={0.5}>
                You've been invited to join
              </Typography>
              <Typography
                variant="h5"
                fontFamily='"Bebas Neue", sans-serif'
                letterSpacing="0.5px"
              >
                {leagueName}
              </Typography>
            </Box>

            {alreadyMember ? (
              <Stack spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary" fontFamily='"Work Sans", sans-serif'>
                  You're already a member of {leagueName}.
                </Typography>
                <Button component={RouterLink} to="/dashboard" variant="contained">
                  Go to Dashboard
                </Button>
              </Stack>
            ) : !user ? (
              <Stack spacing={1.5} width="100%">
                <Typography variant="body2" color="text.secondary" fontFamily='"Work Sans", sans-serif'>
                  Log in or create an account to join.
                </Typography>
                <Button
                  component={RouterLink}
                  to={`/login?redirect=${encodeURIComponent(`/join/${inviteCode}`)}`}
                  variant="contained"
                  fullWidth
                >
                  Log In
                </Button>
                <Button
                  component={RouterLink}
                  to={`/register?redirect=${encodeURIComponent(`/join/${inviteCode}`)}`}
                  variant="outlined"
                  fullWidth
                >
                  Create Account
                </Button>
              </Stack>
            ) : (
              <Stack spacing={1.5} width="100%">
                {joinError && (
                  <Alert severity="error" sx={{ textAlign: 'left' }}>
                    {joinError}
                  </Alert>
                )}
                <Button
                  variant="contained"
                  fullWidth
                  disabled={joining}
                  startIcon={joining ? <CircularProgress size={16} color="inherit" /> : undefined}
                  onClick={handleJoin}
                >
                  {joining ? 'Joining...' : 'Join League'}
                </Button>
                <Button variant="outlined" fullWidth onClick={() => navigate(-1)}>
                  Decline
                </Button>
              </Stack>
            )}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
