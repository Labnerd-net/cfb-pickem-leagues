# Implementation Plan: Authentication Forms Upgrade

## Context

The authentication forms currently exist as basic HTML forms with React Hook Form validation, but lack Material-UI styling, user feedback, and several required features. This plan upgrades both login and registration forms to production-quality UX with proper error handling, loading states, password visibility toggles, and navigation between forms.

**Current State:**
- Login/registration forms use plain HTML `<input>` and `<button>` elements
- No error display for API failures
- No loading states during submission
- No password visibility toggle
- No navigation between forms
- Registration form missing display name field
- API layer silently swallows errors (only logs to console)
- No redirect after successful authentication

**User Requirements (from spec):**
- Material-UI styled forms with proper layout
- Password visibility toggles (independent for each field)
- Display name field on registration
- Remember me checkbox on login
- Navigation links between login/registration
- Error messages displayed in UI
- Loading states with disabled submit buttons
- Redirect to `/` after successful auth

## Critical Files

**Frontend:**
- `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/apis/authRequests.ts` - Add error handling
- `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/login.tsx` - Complete MUI overhaul
- `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/registration.tsx` - Complete MUI overhaul
- `/home/bladner/Documents/programming/cfb-pickem/packages/frontend/src/components/auth/PasswordField.tsx` - New reusable component

**Backend:**
- `/home/bladner/Documents/programming/cfb-pickem/packages/backend/src/routes/auth.ts` - Accept displayName on registration

**Shared:**
- `/home/bladner/Documents/programming/cfb-pickem/packages/shared/types/cfb-pickem-api.ts` - Add displayName to types

## Implementation Steps

### Step 1: Update Shared Types

**File:** `packages/shared/types/cfb-pickem-api.ts`

Add `displayName` field to interfaces:
```typescript
export interface RegistrationData extends Credentials {
  confirmPassword: string;
  displayName: string;  // NEW
}

export interface ProfileData {
  userId: number;
  email: string;
  roles: Role[];
  displayName: string;  // NEW
}

export interface UserData extends ProfileData {
  passwordHash: string;
}
```

### Step 2: Update Backend Registration Endpoint

**File:** `packages/backend/src/routes/auth.ts`

Update `/register` endpoint (line 25-71):
1. Extract `displayName` from request body: `const { email, password, displayName } = await c.req.json()`
2. Validate displayName is present and length (1-50 chars)
3. Pass displayName to `addUser()`: `const user = { email, passwordHash, roles, displayName } as UserData`
4. Update database schema if needed to store displayName column

**Note:** Check if database schema already has displayName column. If not, create migration to add it.

### Step 3: Fix API Layer Error Handling

**File:** `packages/frontend/src/apis/authRequests.ts`

Refactor both `loginUser()` and `registerUser()` to return structured error objects:

```typescript
interface AuthResponse {
  success: boolean;
  data?: { token: string; id?: number };
  error?: string;
}

export async function loginUser(credentials: Credentials): Promise<AuthResponse> {
  try {
    const response = await axios.post(`${databaseAPI}/${path}/login`, credentials);
    if (response.data.ok) {
      localStorage.setItem('jwt', response.data.data.token);
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      return { success: false, error: error.response.data.error };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function registerUser(data: RegistrationData): Promise<AuthResponse> {
  const { email, password, displayName } = data;
  try {
    const response = await axios.post(`${databaseAPI}/${path}/register`, {
      email,
      password,
      displayName,
    });
    if (response.data.ok) {
      localStorage.setItem('jwt', response.data.data.token);
      return { success: true, data: response.data.data };
    }
    return { success: false, error: response.data.error };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data?.error) {
      return { success: false, error: error.response.data.error };
    }
    return { success: false, error: 'An unexpected error occurred' };
  }
}
```

**Key changes:**
- Return `Promise<AuthResponse>` with structured response
- Check backend's `ok` field to determine success
- Extract error message from `response.data.error`
- Handle axios errors properly
- No more silent error swallowing

### Step 4: Create Reusable PasswordField Component

**File:** `packages/frontend/src/components/auth/PasswordField.tsx` (NEW)

Create a reusable password field with visibility toggle:

```typescript
import { useState } from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import type { UseFormRegister, FieldError } from 'react-hook-form';

interface PasswordFieldProps {
  name: string;
  label: string;
  register: UseFormRegister<any>;
  error?: FieldError;
  autoComplete?: string;
}

export default function PasswordField({
  name,
  label,
  register,
  error,
  autoComplete = 'current-password',
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <TextField
      fullWidth
      type={showPassword ? 'text' : 'password'}
      label={label}
      {...register(name)}
      error={!!error}
      helperText={error?.message}
      autoComplete={autoComplete}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
```

**Features:**
- Independent state for each instance (password and confirmPassword won't conflict)
- Material-UI TextField with proper styling
- Visibility/VisibilityOff icons
- Error display from React Hook Form
- Accessibility labels

### Step 5: Upgrade Login Form

**File:** `packages/frontend/src/components/login.tsx`

Complete Material-UI overhaul:

**Imports:**
```typescript
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
```

**State:**
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [rememberMe, setRememberMe] = useState(false);
const navigate = useNavigate();
```

**Form submission:**
```typescript
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
```

**JSX Layout:**
```tsx
<Container maxWidth="sm">
  <Box sx={{ mt: 8, mb: 4 }}>
    <Paper elevation={3} sx={{ p: 4 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Login
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
            disabled={loading || !formState.isValid}
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
```

**Key features:**
- Material-UI Container/Paper layout
- TextField for email with error display
- PasswordField component with visibility toggle
- Remember me checkbox
- Loading state with CircularProgress
- Error Alert display
- Disabled button during loading or invalid form
- Navigation link to registration
- Redirect to `/` on success

### Step 6: Upgrade Registration Form

**File:** `packages/frontend/src/components/registration.tsx`

Complete Material-UI overhaul with display name field:

**Update Zod Schema:**
```typescript
const RegistrationSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
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
```

**Imports:** (Same as login plus Stack)

**State:**
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const navigate = useNavigate();
```

**Form submission:**
```typescript
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
```

**JSX Layout:**
```tsx
<Container maxWidth="sm">
  <Box sx={{ mt: 8, mb: 4 }}>
    <Paper elevation={3} sx={{ p: 4 }}>
      <Typography variant="h4" align="center" gutterBottom>
        Sign Up
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
            disabled={loading || !formState.isValid}
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
```

**Key features:**
- Display name field between email and password
- Two independent PasswordField instances (password and confirmPassword)
- Material-UI layout matching login form
- Error and loading state handling
- Navigation link to login
- Redirect to `/` on success

## Verification

After implementation, test the following:

### Login Form
1. Navigate to `/login` - form renders with Material-UI styling
2. Submit empty form - validation errors display
3. Enter invalid email - shows "Please enter a valid email address"
4. Enter short password - shows "Password must be at least 6 characters long"
5. Click password visibility icon - password text toggles between visible/hidden
6. Check "Remember me" - checkbox toggles state
7. Submit with invalid credentials - displays backend error message
8. Submit with valid credentials - redirects to `/` and stores JWT token
9. Click "Sign up" link - navigates to `/register`
10. Check loading state - button shows spinner and is disabled during submission

### Registration Form
1. Navigate to `/register` - form renders with all fields
2. Submit empty form - validation errors display for all required fields
3. Enter invalid email - shows email format error
4. Enter display name > 50 chars - shows max length error
5. Enter mismatched passwords - shows "Passwords do not match" on confirmPassword field
6. Click password visibility icons - each field toggles independently
7. Submit with existing email - displays "User already exists" error
8. Submit with valid data - redirects to `/` and stores JWT token
9. Click "Log in" link - navigates to `/login`
10. Check loading state - button shows spinner and is disabled during submission

### Backend Validation
1. Test displayName is stored in database after registration
2. Test displayName validation (empty string rejected)
3. Test email validation still works
4. Test password validation still works

### API Error Handling
1. Simulate network error - displays "An unexpected error occurred"
2. Test duplicate email registration - displays appropriate error
3. Test invalid credentials login - displays "Invalid credentials"
4. Verify JWT token stored in localStorage on success

### Navigation
1. Verify link from login to registration works
2. Verify link from registration to login works
3. Verify redirect to `/` after successful auth (both login and registration)

### Responsive Design
1. View forms on mobile viewport - layout adjusts properly
2. Check touch targets are appropriately sized
3. Verify text is readable at all sizes
