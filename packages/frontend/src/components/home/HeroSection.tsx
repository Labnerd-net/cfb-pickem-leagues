import { Box, Container, Stack, Typography, Button, alpha, useTheme } from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import { useNavigate } from 'react-router';

interface HeroSectionProps {
  isVisible: boolean;
}

export default function HeroSection({ isVisible }: HeroSectionProps) {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: 'relative',
        pt: { xs: 6, md: 8 },
        pb: { xs: 12, md: 16 },
        background: `linear-gradient(180deg, ${alpha(theme.palette.primary.dark, 0.4)} 0%, ${theme.palette.background.default} 100%)`,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 80px,
              ${alpha(theme.palette.primary.main, 0.03)} 80px,
              ${alpha(theme.palette.primary.main, 0.03)} 82px
            )
          `,
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60%',
          background: `radial-gradient(ellipse at top, ${alpha(theme.palette.secondary.main, 0.08)} 0%, transparent 70%)`,
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Stack spacing={3} alignItems="center" textAlign="center">
          {/* Main Logo/Icon */}
          <Box
            className={isVisible ? 'animate-in' : ''}
            sx={{
              display: 'inline-flex',
              p: 3,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
              border: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              animation: 'glow 2s ease-in-out infinite',
            }}
          >
            <SportsFootballIcon
              sx={{
                fontSize: { xs: 60, md: 80 },
                color: 'primary.main',
              }}
            />
          </Box>

          {/* Headline - Bold Athletic Typography */}
          <Box className={isVisible ? 'animate-in animate-delay-1' : ''} sx={{ maxWidth: '900px' }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: '"Bebas Neue", cursive',
                fontSize: { xs: '3.5rem', sm: '5rem', md: '7rem' },
                fontWeight: 400,
                lineHeight: 0.9,
                letterSpacing: '0.02em',
                color: 'primary.main',
                textTransform: 'uppercase',
                mb: 2,
                textShadow: `4px 4px 0px ${alpha(theme.palette.secondary.main, 0.2)}`,
              }}
            >
              Pick. Play. Win.
            </Typography>
            <Typography
              component="h2"
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.6rem' },
                fontWeight: 600,
                color: 'text.primary',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              College Football Pick'em
            </Typography>
          </Box>

          {/* Tagline */}
          <Typography
            className={isVisible ? 'animate-in animate-delay-2' : ''}
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              fontSize: { xs: '1rem', md: '1.2rem' },
              fontWeight: 400,
              color: 'text.secondary',
              maxWidth: '600px',
              lineHeight: 1.6,
            }}
          >
            Predict game winners. Track your performance. Dominate the leaderboard. Every pick
            counts.
          </Typography>

          {/* CTA Buttons */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            className={isVisible ? 'animate-in animate-delay-3' : ''}
            sx={{ mt: 3 }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                fontSize: '1.1rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                px: 5,
                py: 2,
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
              }}
            >
              Start Playing Free
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/login')}
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                fontSize: '1.1rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                px: 5,
                py: 2,
                borderWidth: '3px',
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  borderWidth: '3px',
                  borderColor: 'primary.light',
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                },
              }}
            >
              Sign In
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
