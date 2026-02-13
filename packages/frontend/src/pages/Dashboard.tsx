import { useState } from 'react';
import { Container, Box, Tabs, Tab } from '@mui/material';
import { useAuth } from '../contexts/auth/AuthContext';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import WelcomeBanner from '../components/dashboard/WelcomeBanner';
import AdminSection from '../components/admin/AdminSection';
import UserSection from '../components/user/UserSection';

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
            {currentTab === 0 ? <UserSection /> : <AdminSection />}
          </>
        ) : <UserSection />
        }
      </Box>
    </Container>
  );
}
