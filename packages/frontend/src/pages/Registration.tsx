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
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import type { RegistrationData } from '@shared/types/cfb-pickem-api';
import { registerUser } from '../apis/authRequests';
import PasswordField from '../components/auth/PasswordField';

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
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

const RegistrationForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RegistrationData>({
    resolver: zodResolver(RegistrationSchema),
    mode: 'onBlur',
  });

  const onSubmit: SubmitHandler<RegistrationData> = async (data) => {
    setLoading(true);
    setError(null);

    const result = await registerUser(data);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Registration failed');
    }

    setLoading(false);
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom>
            Sign Up
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

              <TextField
                fullWidth
                label="Display Name"
                {...register('displayName')}
                error={!!errors.displayName}
                helperText={errors.displayName?.message}
                autoComplete="name"
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

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading || !isValid}
              >
                {loading ? <CircularProgress size={24} /> : 'Sign Up'}
              </Button>
            </Stack>
          </form>

          <Typography align="center" sx={{ mt: 2 }}>
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">
              Log in
            </Link>
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default RegistrationForm;
