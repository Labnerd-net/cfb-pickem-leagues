import { Button, CircularProgress, alpha, useTheme } from '@mui/material';
import { type ReactNode } from 'react';

interface SubmitButtonProps {
  loading: boolean;
  disabled: boolean;
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export default function SubmitButton({
  loading,
  disabled,
  children,
  onClick,
  type = 'submit'
}: SubmitButtonProps) {
  const theme = useTheme();

  return (
    <Button
      type={type}
      variant="contained"
      fullWidth
      size="large"
      disabled={disabled}
      onClick={onClick}
      sx={{
        fontFamily: '"Work Sans", sans-serif',
        fontSize: '1.1rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        py: 1.5,
        background: theme.palette.secondary.main,
        color: theme.palette.secondary.contrastText,
        border: `3px solid ${theme.palette.secondary.dark}`,
        boxShadow: `0 6px 0 ${theme.palette.secondary.dark}`,
        transform: 'translateY(0)',
        transition: 'all 0.15s ease',
        '&:hover': {
          background: theme.palette.secondary.light,
          transform: 'translateY(3px)',
          boxShadow: `0 3px 0 ${theme.palette.secondary.dark}`,
        },
        '&:active': {
          transform: 'translateY(6px)',
          boxShadow: 'none',
        },
        '&:disabled': {
          background: alpha(theme.palette.secondary.main, 0.5),
          border: `3px solid ${alpha(theme.palette.secondary.dark, 0.5)}`,
          color: alpha(theme.palette.secondary.contrastText, 0.7),
          transform: 'none',
          boxShadow: 'none',
        },
      }}
    >
      {loading ? <CircularProgress size={24} /> : children}
    </Button>
  );
}
