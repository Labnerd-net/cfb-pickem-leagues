import { Box, Container, Typography, alpha, useTheme } from '@mui/material';

interface StatsBarProps {
  isVisible: boolean;
}

export default function StatsBar({ isVisible }: StatsBarProps) {
  const theme = useTheme();

  const stats = [
    { number: '100+', label: 'Games Per Season' },
    { number: '∞', label: 'Bragging Rights' },
    { number: '0$', label: 'To Get Started' },
  ];

  return (
    <Box
      sx={{
        background: theme.palette.primary.dark,
        borderTop: `4px solid ${theme.palette.secondary.main}`,
        borderBottom: `4px solid ${theme.palette.secondary.main}`,
        py: 4,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.secondary.main, 0.1)}, transparent)`,
          animation: 'pulse 3s ease-in-out infinite',
        },
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-around',
            gap: 4,
            textAlign: 'center',
          }}
        >
          {stats.map((stat, index) => (
            <Box
              key={index}
              className={isVisible ? 'stat-card' : ''}
              sx={{
                flex: 1,
                animationDelay: `${0.8 + index * 0.2}s`,
                opacity: isVisible ? 1 : 0,
              }}
            >
              <Typography
                sx={{
                  fontFamily: '"Bebas Neue", cursive',
                  fontSize: { xs: '3rem', md: '4rem' },
                  color: 'secondary.main',
                  lineHeight: 1,
                  mb: 1,
                }}
              >
                {stat.number}
              </Typography>
              <Typography
                sx={{
                  fontFamily: '"Work Sans", sans-serif',
                  fontSize: { xs: '0.9rem', md: '1rem' },
                  fontWeight: 600,
                  color: alpha(theme.palette.common.white, 0.9),
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
