import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Container,
  Box,
  TextField,
  Typography,
  Link,
  FormControlLabel,
  Checkbox,
  Alert,
  Stack,
} from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import type { Credentials } from '@shared/types/cfb-pickem-api';
import { loginUser } from '../apis/authRequests';
import PasswordField from '../components/auth/PasswordField';
import AuthFormCard from '../components/auth/AuthFormCard';
import AuthHeader from '../components/auth/AuthHeader';
import SubmitButton from '../components/auth/SubmitButton';
import { useAuth } from '../contexts/auth/AuthContext';

const LoginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

const LoginForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

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

    if (result.success && result.data?.token) {
      try {
        await login(result.data.token);
        if (rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }
        navigate('/dashboard');
      } catch {
        setError('Failed to load user profile');
      }
    } else {
      setError(result.error || 'Login failed');
    }

    setLoading(false);
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <AuthFormCard>
          <AuthHeader
            icon={<SportsFootballIcon sx={{ fontSize: 40, color: 'primary.main' }} />}
            title="Welcome Back"
            iconColor="primary"
          />

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                fontFamily: '"Work Sans", sans-serif',
                borderLeft: (theme) => `4px solid ${theme.palette.error.main}`,
              }}
            >
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
                sx={{
                  '& label': {
                    fontFamily: '"Work Sans", sans-serif',
                    fontWeight: 600,
                  },
                }}
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
                    sx={{
                      '&.Mui-checked': {
                        color: 'primary.main',
                      },
                    }}
                  />
                }
                label={
                  <Typography
                    sx={{
                      fontFamily: '"Work Sans", sans-serif',
                      fontWeight: 500,
                    }}
                  >
                    Remember me
                  </Typography>
                }
              />

              <SubmitButton loading={loading} disabled={loading || !isValid}>
                Login
              </SubmitButton>
            </Stack>
          </form>

          <Typography
            align="center"
            sx={{
              mt: 3,
              fontFamily: '"Work Sans", sans-serif',
              fontWeight: 500,
            }}
          >
            Don't have an account?{' '}
            <Link
              component={RouterLink}
              to="/register"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                textDecoration: 'none',
                '&:hover': {
                  color: 'secondary.main',
                  textDecoration: 'underline',
                },
              }}
            >
              Sign up
            </Link>
          </Typography>
        </AuthFormCard>
      </Box>
    </Container>
  );
};

export default LoginForm;
