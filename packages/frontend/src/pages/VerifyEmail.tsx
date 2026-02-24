import { useEffect, useState } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { verifyEmailToken } from '../apis/authRequests';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');

  useEffect(() => {
    if (!token) return;
    verifyEmailToken(token).then(res => {
      setStatus(res.success ? 'success' : 'error');
    });
  }, [token]);

  if (status === 'loading') {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth={480} mx="auto" mt={8} px={2} textAlign="center">
      {status === 'success' ? (
        <>
          <Typography variant="h5" gutterBottom>
            Email verified!
          </Typography>
          <Typography color="text.secondary" mb={3}>
            Your email address has been verified.
          </Typography>
          <Button component={RouterLink} to="/dashboard" variant="contained">
            Go to dashboard
          </Button>
        </>
      ) : (
        <>
          <Typography variant="h5" gutterBottom>
            Verification failed
          </Typography>
          <Typography color="text.secondary" mb={3}>
            The verification link is invalid or has expired.
          </Typography>
          <Button component={RouterLink} to="/settings" variant="outlined">
            Go to settings to resend
          </Button>
        </>
      )}
    </Box>
  );
}
