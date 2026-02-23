import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Container, Box, TextField, Typography, Link, Alert, Stack } from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import type { RegistrationFormData } from '@shared/types/cfb-pickem-api';
import { registerUser } from '../apis/authRequests';
import PasswordField from '../components/auth/PasswordField';
import AuthFormCard from '../components/auth/AuthFormCard';
import AuthHeader from '../components/auth/AuthHeader';
import SubmitButton from '../components/auth/SubmitButton';
import { useAuth } from '../contexts/auth/AuthContext';

const RegistrationSchema = z
  .object({
    email: z.email('Please enter a valid email address'),
    displayName: z
      .string()
      .min(1, 'Display name is required')
      .max(50, 'Display name must be less than 50 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    confirmPassword: z.string().min(6, 'Please repeat the password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

const RegistrationForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(RegistrationSchema),
    mode: 'onBlur',
  });

  const onSubmit: SubmitHandler<RegistrationFormData> = async data => {
    setLoading(true);
    setError(null);

    const result = await registerUser(data);

    if (result.success) {
      try {
        await login();
        navigate('/dashboard');
      } catch {
        setError('Failed to load user profile');
      }
    } else {
      setError(result.error || 'Registration failed');
    }

    setLoading(false);
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <AuthFormCard accentColor="secondary">
          <AuthHeader
            icon={<EmojiEventsIcon sx={{ fontSize: 40, color: 'secondary.main' }} />}
            title="Join the Game"
            subtitle="Create your account and start making picks"
            iconColor="secondary"
          />

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                fontFamily: '"Work Sans", sans-serif',
                borderLeft: theme => `4px solid ${theme.palette.error.main}`,
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

              <TextField
                fullWidth
                label="Display Name"
                {...register('displayName')}
                error={!!errors.displayName}
                helperText={errors.displayName?.message}
                autoComplete="name"
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
                autoComplete="new-password"
              />

              <PasswordField
                name="confirmPassword"
                label="Verify Password"
                register={register}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />

              <SubmitButton loading={loading} disabled={loading || !isValid}>
                Sign Up
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
            Already have an account?{' '}
            <Link
              component={RouterLink}
              to="/login"
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
              Log in
            </Link>
          </Typography>
        </AuthFormCard>
      </Box>
    </Container>
  );
};

export default RegistrationForm;
