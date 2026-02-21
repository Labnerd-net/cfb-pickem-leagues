import { AppBar, Toolbar, Typography, Button, Box, alpha, useTheme } from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import { useNavigate } from 'react-router';
import ThemeToggle from '../theme/ThemeToggle';
import { useAuth } from '../../contexts/auth/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleHomeClick = () => {
    navigate('/');
  };

  return (
    <AppBar
        position="static"
        elevation={0}
        sx={{
          background: theme.palette.background.paper,
          borderBottom: `4px solid ${theme.palette.secondary.main}`,
          boxShadow: `0 4px 12px ${alpha('#000', 0.2)}`,
        }}
      >
        <Toolbar sx={{ py: 1 }}>
          {/* Logo & Title */}
          <Box
            onClick={handleHomeClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                border: `2px solid ${theme.palette.secondary.main}`,
                mr: 2,
              }}
            >
              <SportsFootballIcon
                sx={{
                  color: 'common.white',
                  fontSize: 24,
                }}
              />
            </Box>
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontFamily: '"Bebas Neue", cursive',
                fontSize: { xs: '1.3rem', sm: '1.8rem' },
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'text.primary',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              CFB Pick'em
            </Typography>
          </Box>

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* User Info */}
          {user && (
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'text.secondary',
                mr: 2,
                display: { xs: 'none', md: 'block' },
              }}
            >
              {user.displayName}
            </Typography>
          )}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Logout Button */}
          {user && (
            <Button
              onClick={handleLogout}
              sx={{
                ml: 2,
                fontFamily: '"Work Sans", sans-serif',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                px: 3,
                py: 1,
                border: `2px solid ${theme.palette.primary.main}`,
                color: 'primary.main',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: theme.palette.secondary.main,
                  color: 'secondary.main',
                  backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                },
              }}
            >
              Logout
            </Button>
          )}
        </Toolbar>
      </AppBar>
  );
}
