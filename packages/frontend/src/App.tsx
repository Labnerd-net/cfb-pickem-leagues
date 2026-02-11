import { BrowserRouter, Route, Routes, Navigate } from 'react-router';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import RegistrationForm from './components/registration';
import LoginForm from './components/login';
import Home from './components/Home';
import { ThemeProvider } from './contexts/ThemeProvider';
import ThemeToggle from './components/ThemeToggle';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Box sx={{ flexGrow: 1 }}>
          {/* App Bar */}
          <AppBar position="static" elevation={2}>
            <Toolbar>
              <SportsFootballIcon sx={{ mr: 2 }} />
              <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                College Football Pick'em
              </Typography>
              <ThemeToggle />
            </Toolbar>
          </AppBar>

          {/* Main Content */}
          <Routes>
            <Route index element={<Home />} />
            <Route path="login" element={<LoginForm />} />
            <Route path="register" element={<RegistrationForm />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
