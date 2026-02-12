import { AppBar, Toolbar, Typography, Button } from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import { useNavigate } from 'react-router';
import ThemeToggle from './theme/ThemeToggle';
import { useAuth } from '../contexts/auth/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleHomeClick = () => {
    navigate('/');
  };

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar>
        <SportsFootballIcon
          sx={{ mr: 2, cursor: 'pointer' }}
          onClick={handleHomeClick}
        />
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={handleHomeClick}
        >
          College Football Pick'em
        </Typography>
        <ThemeToggle />
        {user && (
          <Button color="inherit" onClick={handleLogout} sx={{ ml: 2 }}>
            Logout
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}
