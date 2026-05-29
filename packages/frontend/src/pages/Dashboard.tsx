import { useState } from 'react';
import { Container, Box, Tabs, Tab, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/auth/AuthContext';
import { useLeague } from '../contexts/LeagueContext';
import JoinLeaguePrompt from '../components/JoinLeaguePrompt';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import BugReportIcon from '@mui/icons-material/BugReport';
import NotificationsIcon from '@mui/icons-material/Notifications';
import GroupsIcon from '@mui/icons-material/Groups';
import WelcomeBanner from '../components/dashboard/WelcomeBanner';
import AdminSection from '../components/admin/AdminSection';
import LeagueAdminSection from '../components/admin/LeagueAdminSection';
import UsersSection from '../components/admin/UsersSection';
import NotificationLogSection from '../components/admin/NotificationLogSection';
import UserSection from '../components/user/UserSection';
import DevSection from '../components/admin/DevSection';

const IS_DEV = import.meta.env.DEV;

interface TabDescriptor {
  label: string;
  icon: React.ReactElement;
  component: React.ReactElement;
  devOnly?: boolean;
  warnColor?: boolean;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { activeLeague, isLoading: leagueLoading, refetchLeagues } = useLeague();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isLeagueAdmin = activeLeague?.role === 'admin';
  const [currentTab, setCurrentTab] = useState(0);

  if (leagueLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!activeLeague) {
    return <JoinLeaguePrompt onJoined={refetchLeagues} />;
  }

  const tabs: TabDescriptor[] = [
    { label: 'My Dashboard', icon: <SportsFootballIcon />, component: <UserSection /> },
    ...(isLeagueAdmin
      ? [{ label: 'League Admin', icon: <GroupsIcon />, component: <LeagueAdminSection /> }]
      : []),
    ...(isAdmin
      ? [
          { label: 'Admin Controls', icon: <AdminPanelSettingsIcon />, component: <AdminSection /> },
          { label: 'Users', icon: <PeopleIcon />, component: <UsersSection /> },
          { label: 'Notification Log', icon: <NotificationsIcon />, component: <NotificationLogSection /> },
        ]
      : []),
    ...(IS_DEV
      ? [{ label: 'Dev Tools', icon: <BugReportIcon />, component: <DevSection />, devOnly: true, warnColor: true }]
      : []),
  ];

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const safeTab = Math.min(currentTab, tabs.length - 1);

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <WelcomeBanner displayName={user?.displayName || 'User'} />

        {isAdmin || isLeagueAdmin ? (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs
                value={safeTab}
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
                {tabs.map(tab => (
                  <Tab
                    key={tab.label}
                    icon={tab.icon}
                    iconPosition="start"
                    label={tab.label}
                    sx={tab.warnColor ? { color: 'warning.main' } : undefined}
                  />
                ))}
              </Tabs>
            </Box>
            {tabs[safeTab]?.component ?? null}
          </>
        ) : (
          <UserSection />
        )}
      </Box>
    </Container>
  );
}
