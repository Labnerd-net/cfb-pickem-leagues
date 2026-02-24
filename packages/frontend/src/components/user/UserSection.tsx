import { Box } from '@mui/material';
import DashboardCard from '../dashboard/DashboardCard';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WeekGameSection from './WeekGameSection';
import LeaderboardSection from './LeaderboardSection';

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
        icon={<CalendarMonthIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />}
        title="Weekly Games"
        accentColor="primary"
        gridColumn={{ xs: '1', md: 'span 2' }}
      >
        <WeekGameSection />
      </DashboardCard>

      <DashboardCard
        icon={<LeaderboardIcon sx={{ fontSize: 32, color: 'secondary.main', mr: 2 }} />}
        title="Leaderboard"
        accentColor="secondary"
      >
        <LeaderboardSection />
      </DashboardCard>
    </Box>
  );
}
