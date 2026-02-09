import { BrowserRouter, Route, Routes } from 'react-router';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import RegistrationForm from './components/registration';
import LoginForm from './components/login';

function App() {
  const theme = createTheme({
    palette: {
      mode: 'dark', // or 'light'
    },
  });

  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline />
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
