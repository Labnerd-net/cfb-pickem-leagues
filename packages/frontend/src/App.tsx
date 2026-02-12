import { BrowserRouter, Route, Routes, Navigate } from 'react-router';
import { Box } from '@mui/material';
import RegistrationForm from './pages/Registration';
import LoginForm from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import { ThemeProvider } from './contexts/theme/ThemeProvider';
import { AuthProvider } from './contexts/auth/AuthProvider';
import Navbar from './components/navbar/Navbar';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Box sx={{ flexGrow: 1 }}>
            <Navbar />

            {/* Main Content */}
            <Routes>
              <Route index element={<Home />} />
              <Route path="login" element={<LoginForm />} />
              <Route path="register" element={<RegistrationForm />} />
              <Route
                path="dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Box>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
