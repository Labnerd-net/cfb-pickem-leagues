import { Paper, alpha, useTheme } from '@mui/material';
import { type ReactNode } from 'react';

interface AuthFormCardProps {
  children: ReactNode;
  accentColor?: 'primary' | 'secondary';
}

export default function AuthFormCard({
  children,
  accentColor = 'primary'
}: AuthFormCardProps) {
  const theme = useTheme();
  const color = accentColor === 'primary'
    ? theme.palette.primary.main
    : theme.palette.secondary.main;

  return (
    <Paper
      elevation={4}
      sx={{
        p: 5,
        border: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        borderTop: `6px solid ${theme.palette.secondary.main}`,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100%',
          height: '200px',
          background: `radial-gradient(circle at top right, ${alpha(color, 0.08)} 0%, transparent 70%)`,
          pointerEvents: 'none',
        },
      }}
    >
      {children}
    </Paper>
  );
}
