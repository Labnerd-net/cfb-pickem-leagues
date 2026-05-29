import { BrowserRouter, Route, Routes, Navigate } from 'react-router';
import { Box } from '@mui/material';
import RegistrationForm from './pages/Registration';
import LoginForm from './pages/Login';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import VerifyEmail from './pages/VerifyEmail';
import { ThemeProvider } from './contexts/theme/ThemeProvider';
import { AuthProvider } from './contexts/auth/AuthProvider';
import { LeagueProvider } from './contexts/LeagueContext';
import Navbar from './components/navbar/Navbar';
import PrivateRoute from './components/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LeagueProvider>
          <ErrorBoundary>
            <BrowserRouter>
              <Box sx={{ flexGrow: 1 }}>
                <Navbar />

                {/* Main Content */}
                <Box component="main">
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
                    <Route
                      path="settings"
                      element={
                        <PrivateRoute>
                          <Settings />
                        </PrivateRoute>
                      }
                    />
                    <Route path="verify-email" element={<VerifyEmail />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Box>
              </Box>
            </BrowserRouter>
          </ErrorBoundary>
        </LeagueProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
