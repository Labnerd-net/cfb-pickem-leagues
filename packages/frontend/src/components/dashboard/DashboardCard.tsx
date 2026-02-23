import { Paper, Box, Typography, alpha, useTheme } from '@mui/material';
import { type ReactNode } from 'react';

interface DashboardCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  accentColor?: 'primary' | 'secondary';
  gridColumn?: Record<string, string | number>;
}

export default function DashboardCard({
  icon,
  title,
  children,
  accentColor = 'primary',
  gridColumn,
}: DashboardCardProps) {
  const theme = useTheme();
  const color =
    accentColor === 'primary' ? theme.palette.primary.main : theme.palette.secondary.main;

  return (
    <Paper
      elevation={3}
      sx={{
        p: 4,
        border: `3px solid ${alpha(color, 0.2)}`,
        borderRadius: 2,
        position: 'relative',
        transition: 'all 0.3s ease',
        gridColumn,
        '&:hover': {
          borderColor: color,
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 16px ${alpha(color, 0.2)}`,
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -3,
          left: -3,
          right: -3,
          height: '6px',
          background: color,
          borderRadius: '2px 2px 0 0',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {icon}
        <Typography
          variant="h5"
          sx={{
            fontFamily: '"Work Sans", sans-serif',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </Typography>
      </Box>
      {children}
    </Paper>
  );
}
