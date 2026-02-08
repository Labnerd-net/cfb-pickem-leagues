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
      <RegistrationForm />
      <LoginForm />
    </ThemeProvider>
  );
}

export default App;
