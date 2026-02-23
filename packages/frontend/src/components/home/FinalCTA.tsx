import { Box, Container, Typography, Button, alpha, useTheme } from '@mui/material';
import { useNavigate } from 'react-router';

export default function FinalCTA() {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Container maxWidth="md" sx={{ mt: 12 }}>
      <Box
        sx={{
          position: 'relative',
          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
          border: `4px solid ${theme.palette.secondary.main}`,
          borderRadius: 3,
          p: { xs: 5, md: 7 },
          textAlign: 'center',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 20px,
              ${alpha(theme.palette.secondary.main, 0.05)} 20px,
              ${alpha(theme.palette.secondary.main, 0.05)} 40px
            )`,
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            sx={{
              fontFamily: '"Bebas Neue", cursive',
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
              color: 'common.white',
              lineHeight: 1,
              mb: 3,
              textTransform: 'uppercase',
              textShadow: `3px 3px 0 ${theme.palette.secondary.main}`,
            }}
          >
            Game On.
          </Typography>
          <Typography
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              fontSize: { xs: '1rem', md: '1.2rem' },
              color: alpha(theme.palette.common.white, 0.95),
              mb: 4,
              fontWeight: 500,
            }}
          >
            Join the competition. Make your picks. Show everyone who runs the board.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/register')}
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              fontSize: '1.3rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              px: 6,
              py: 2.5,
              background: theme.palette.secondary.main,
              color: theme.palette.secondary.contrastText,
              border: `3px solid ${theme.palette.secondary.dark}`,
              boxShadow: `0 8px 0 ${theme.palette.secondary.dark}`,
              transform: 'translateY(0)',
              transition: 'all 0.15s ease',
              '&:hover': {
                background: theme.palette.secondary.light,
                transform: 'translateY(4px)',
                boxShadow: `0 4px 0 ${theme.palette.secondary.dark}`,
              },
              '&:active': {
                transform: 'translateY(8px)',
                boxShadow: 'none',
              },
            }}
          >
            Sign Up Now
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
