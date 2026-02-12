import { Paper, Box, Typography, alpha, useTheme } from '@mui/material';

interface WelcomeBannerProps {
  displayName: string;
}

export default function WelcomeBanner({ displayName }: WelcomeBannerProps) {
  const theme = useTheme();

  return (
    <Paper
      elevation={4}
      sx={{
        p: 5,
        mb: 4,
        border: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        borderTop: `6px solid ${theme.palette.secondary.main}`,
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.primary.dark, 0.05)} 100%)`,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '40%',
          height: '100%',
          background: `radial-gradient(circle at top right, ${alpha(theme.palette.secondary.main, 0.1)} 0%, transparent 70%)`,
          pointerEvents: 'none',
        },
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <Typography
          variant="h3"
          sx={{
            fontFamily: '"Bebas Neue", cursive',
            fontSize: { xs: '2.5rem', md: '3.5rem' },
            color: 'text.primary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            mb: 1,
          }}
        >
          Welcome Back, {displayName}!
        </Typography>
        <Typography
          sx={{
            fontFamily: '"Work Sans", sans-serif',
            fontSize: '1.1rem',
            color: 'text.secondary',
            fontWeight: 500,
          }}
        >
          Ready to dominate this week's picks?
        </Typography>
      </Box>
    </Paper>
  );
}
