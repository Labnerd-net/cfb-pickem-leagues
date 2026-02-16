import { Box, Typography } from '@mui/material';
import DashboardCard from '../dashboard/DashboardCard';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import UserPicksSection from './UserPicksSection';

export default function UserSection() {
  return (
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
        <UserPicksSection />
      </DashboardCard>
    </Box>
  );
}