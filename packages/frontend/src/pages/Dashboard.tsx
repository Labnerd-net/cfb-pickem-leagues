import { useState } from 'react';
import { Container, Box, Tabs, Tab } from '@mui/material';
import { useAuth } from '../contexts/auth/AuthContext';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import BugReportIcon from '@mui/icons-material/BugReport';
import WelcomeBanner from '../components/dashboard/WelcomeBanner';
import AdminSection from '../components/admin/AdminSection';
import UsersSection from '../components/admin/UsersSection';
import UserSection from '../components/user/UserSection';
import DevSection from '../components/admin/DevSection';

const IS_DEV = import.meta.env.DEV;

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
                <Tab icon={<SportsFootballIcon />} iconPosition="start" label="My Dashboard" />
                <Tab
                  icon={<AdminPanelSettingsIcon />}
                  iconPosition="start"
                  label="Admin Controls"
                />
                <Tab icon={<PeopleIcon />} iconPosition="start" label="Users" />
                {IS_DEV && (
                  <Tab
                    icon={<BugReportIcon />}
                    iconPosition="start"
                    label="Dev Tools"
                    sx={{ color: 'warning.main' }}
                  />
                )}
              </Tabs>
            </Box>

            {/* Tab Content */}
            {currentTab === 0 ? (
              <UserSection />
            ) : currentTab === 1 ? (
              <AdminSection />
            ) : currentTab === 2 ? (
              <UsersSection />
            ) : (
              <DevSection />
            )}
          </>
        ) : (
          <UserSection />
        )}
      </Box>
    </Container>
  );
}
