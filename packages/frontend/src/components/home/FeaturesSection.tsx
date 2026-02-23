import { Box, Container, Typography, alpha, useTheme } from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

export default function FeaturesSection() {
  const theme = useTheme();

  const features = [
    {
      icon: <SportsFootballIcon sx={{ fontSize: 50 }} />,
      title: 'Make Your Picks',
      description: 'Choose winners for every game each week. Lock in before kickoff.',
      color: theme.palette.primary.main,
      step: '01',
    },
    {
      icon: <TrendingUpIcon sx={{ fontSize: 50 }} />,
      title: 'Track Performance',
      description: 'Watch your record grow. Monitor streaks. Analyze your predictions.',
      color: theme.palette.secondary.main,
      step: '02',
    },
    {
      icon: <EmojiEventsIcon sx={{ fontSize: 50 }} />,
      title: 'Claim Victory',
      description: 'Rise up the rankings. Prove your football knowledge. Own the season.',
      color: theme.palette.primary.main,
      step: '03',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 10 }}>
      <Typography
        sx={{
          fontFamily: '"Bebas Neue", cursive',
          fontSize: { xs: '2.5rem', md: '3.5rem' },
          textAlign: 'center',
          color: 'text.primary',
          mb: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        How to Dominate
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: 4,
        }}
      >
        {features.map((feature, index) => (
          <Box
            key={index}
            sx={{
              position: 'relative',
              background: alpha(theme.palette.background.paper, 0.6),
              border: `3px solid ${alpha(feature.color, 0.3)}`,
              borderRadius: 2,
              p: 4,
              transition: 'all 0.3s ease',
              '&:hover': {
                borderColor: feature.color,
                transform: 'translateY(-8px)',
                boxShadow: `0 12px 24px ${alpha(feature.color, 0.2)}`,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -3,
                left: -3,
                right: -3,
                height: '6px',
                background: feature.color,
                borderRadius: '2px 2px 0 0',
              },
            }}
          >
            {/* Step Number */}
            <Typography
              sx={{
                fontFamily: '"Bebas Neue", cursive',
                fontSize: '1.2rem',
                color: alpha(theme.palette.text.secondary, 0.5),
                letterSpacing: '0.2em',
                mb: 2,
              }}
            >
              {feature.step}
            </Typography>

            {/* Icon */}
            <Box
              sx={{
                display: 'inline-flex',
                color: feature.color,
                mb: 2,
              }}
            >
              {feature.icon}
            </Box>

            {/* Title */}
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'text.primary',
                mb: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {feature.title}
            </Typography>

            {/* Description */}
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                fontSize: '1rem',
                color: 'text.secondary',
                lineHeight: 1.7,
              }}
            >
              {feature.description}
            </Typography>
          </Box>
        ))}
      </Box>
    </Container>
  );
}
