import { useState } from 'react';
import { Container, Box, Typography, Tabs, Tab } from '@mui/material';
import { useAuth } from '../contexts/auth/AuthContext';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import WelcomeBanner from '../components/dashboard/WelcomeBanner';
import DashboardCard from '../components/dashboard/DashboardCard';
import AdminSection from '../components/dashboard/admin/AdminSection';

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <WelcomeBanner displayName={user?.displayName || 'User'} />

        {isAdmin ? (
          <>
            {/* Tabs for Admin Users */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs
                value={currentTab}
                onChange={handleTabChange}
                aria-label="dashboard tabs"
                sx={{
                  '& .MuiTab-root': {
                    fontFamily: '"Bebas Neue", sans-serif',
                    fontSize: '1.1rem',
                    letterSpacing: '0.5px',
                  },
                }}
              >
                <Tab
                  icon={<SportsFootballIcon />}
                  iconPosition="start"
                  label="My Dashboard"
                />
                <Tab
                  icon={<AdminPanelSettingsIcon />}
                  iconPosition="start"
                  label="Admin Controls"
                />
              </Tabs>
            </Box>

            {/* Tab Content */}
            {currentTab === 0 ? (
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
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                  gap: 3,
                }}
              >
                <AdminSection />
              </Box>
            )}
          </>
        ) : (
          // Regular User View (No Tabs)
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
        )}
      </Box>
    </Container>
  );
}
