import { Box, Typography, alpha, useTheme } from '@mui/material';
import { type ReactNode } from 'react';

interface AuthHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  iconColor?: 'primary' | 'secondary';
}

export default function AuthHeader({
  icon,
  title,
  subtitle,
  iconColor = 'primary'
}: AuthHeaderProps) {
  const theme = useTheme();
  const mainColor = iconColor === 'primary'
    ? theme.palette.primary.main
    : theme.palette.secondary.main;
  const accentColor = iconColor === 'primary'
    ? theme.palette.secondary.main
    : theme.palette.primary.main;

  return (
    <Box sx={{ textAlign: 'center', mb: 4, position: 'relative' }}>
      <Box
        sx={{
          display: 'inline-flex',
          p: 2,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${alpha(mainColor, 0.2)} 0%, ${alpha(accentColor, 0.1)} 100%)`,
          border: `2px solid ${mainColor}`,
          mb: 2,
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="h3"
        sx={{
          fontFamily: '"Bebas Neue", cursive',
          fontSize: '3rem',
          color: 'text.primary',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography
          sx={{
            fontFamily: '"Work Sans", sans-serif',
            color: 'text.secondary',
            mt: 1,
          }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
