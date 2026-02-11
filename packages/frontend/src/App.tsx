import { BrowserRouter, Route, Routes } from 'react-router';
import { Box } from '@mui/material';
import RegistrationForm from './components/registration';
import LoginForm from './components/login';
import { ThemeProvider } from './contexts/ThemeProvider';
import ThemeToggle from './components/ThemeToggle';

function App() {
  return (
    <ThemeProvider>
      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
        <ThemeToggle />
      </Box>
      <h1>College Football Pickem</h1>
      <BrowserRouter>
        <Routes>
          {/* <Route index element={<Home />} />
          <Route path="about" element={<About />} />

          <Route element={<AuthLayout />}> */}
          <Route path="login" element={<LoginForm />} />
          <Route path="register" element={<RegistrationForm />} />
          {/* </Route> */}
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
