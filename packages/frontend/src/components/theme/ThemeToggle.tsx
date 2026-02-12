import { IconButton, Tooltip } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import { useTheme } from '../../contexts/theme/ThemeContext';

export default function ThemeToggle() {
  const { mode, toggleTheme } = useTheme();

  const getTooltip = () => {
    if (mode === 'dark') return 'Switch to light mode';
    if (mode === 'light') return 'Switch to LSU theme';
    return 'Switch to dark mode';
  };

  const getIcon = () => {
    if (mode === 'dark') return <Brightness7Icon />;
    if (mode === 'light') return <SportsFootballIcon sx={{ color: '#461D7C' }} />;
    return <Brightness4Icon />;
  };

  return (
    <Tooltip title={getTooltip()}>
      <IconButton onClick={toggleTheme} color="inherit" aria-label="toggle theme">
        {getIcon()}
      </IconButton>
    </Tooltip>
  );
}
