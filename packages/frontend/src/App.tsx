import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

function App() {
  const theme = 'dark'; //or 'light' or 'system'

  return (
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline />
      <h1>College Football Pickem</h1>
    </ThemeProvider>
  );
}

export default App;
