import { Container, Box, Typography } from '@mui/material';
import { useAuth } from '../contexts/auth/AuthContext';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WelcomeBanner from '../components/dashboard/WelcomeBanner';
import DashboardCard from '../components/dashboard/DashboardCard';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <WelcomeBanner displayName={user?.displayName || 'User'} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 3,
          }}
        >
          <DashboardCard
            icon={<SportsFootballIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />}
            title="Your Picks"
            accentColor="primary"
          >
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                color: 'text.secondary',
                fontStyle: 'italic',
              }}
            >
              Coming soon...
            </Typography>
          </DashboardCard>

          <DashboardCard
            icon={<LeaderboardIcon sx={{ fontSize: 32, color: 'secondary.main', mr: 2 }} />}
            title="Leaderboard"
            accentColor="secondary"
          >
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                color: 'text.secondary',
                fontStyle: 'italic',
              }}
            >
              Coming soon...
            </Typography>
          </DashboardCard>

          <DashboardCard
            icon={<CalendarMonthIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />}
            title="This Week's Games"
            accentColor="primary"
            gridColumn={{ xs: '1', md: 'span 2' }}
          >
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                color: 'text.secondary',
                fontStyle: 'italic',
              }}
            >
              Coming soon...
            </Typography>
          </DashboardCard>
        </Box>
      </Box>
    </Container>
  );
}
