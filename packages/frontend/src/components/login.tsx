import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import type { Credentials } from '@shared/types/cfb-pickem-api';
import { loginUser } from '../apis/authRequests';
import PasswordField from './auth/PasswordField';

const LoginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

const LoginForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<Credentials>({
    resolver: zodResolver(LoginSchema),
    mode: 'onBlur',
  });

  const onSubmit: SubmitHandler<Credentials> = async (credentials) => {
    setLoading(true);
    setError(null);

    const result = await loginUser(credentials);

    if (result.success) {
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }
      navigate('/');
    } else {
      setError(result.error || 'Login failed');
    }

    setLoading(false);
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            Login
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
                autoComplete="email"
              />

              <PasswordField
                name="password"
                label="Password"
                register={register}
                error={errors.password}
                autoComplete="current-password"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                }
                label="Remember me"
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading || !isValid}
              >
                {loading ? <CircularProgress size={24} /> : 'Login'}
              </Button>
            </Stack>
          </form>

          <Typography align="center" sx={{ mt: 2 }}>
            Don't have an account?{' '}
            <Link component={RouterLink} to="/register">
              Sign up
            </Link>
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginForm;
