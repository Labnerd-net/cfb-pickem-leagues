import { createTheme } from '@mui/material/styles';

// College football inspired color palette
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2e7d32', // Field green
      light: '#4caf50',
      dark: '#1b5e20',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ff6f00', // Orange accent (like end zone pylons)
      light: '#ff9800',
      dark: '#e65100',
      contrastText: '#ffffff',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    success: {
      main: '#4caf50',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontWeight: 700,
      fontSize: '2rem',
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
    button: {
      textTransform: 'none', // Don't force uppercase buttons
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8, // Slightly rounded corners
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 24px',
          fontSize: '1rem',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Remove default gradient
        },
        elevation1: {
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
        },
        elevation2: {
          boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.3)',
        },
      },
    },
  },
});

// Optional: Create a light mode theme variant
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ff6f00',
      light: '#ff9800',
      dark: '#e65100',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: theme.typography,
  shape: theme.shape,
  components: theme.components,
});

// LSU theme - Purple and Gold
export const lsuTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#461D7C', // LSU Purple
      light: '#5e2a99',
      dark: '#2e1350',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#FDD023', // LSU Gold
      light: '#ffd84f',
      dark: '#ddb600',
      contrastText: '#000000',
    },
    background: {
      default: '#1a0d2e', // Deep purple background
      paper: '#2a1650', // Darker purple for paper
    },
    success: {
      main: '#4caf50',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#FDD023', // Use LSU gold for warnings
    },
    info: {
      main: '#7c4dff',
    },
  },
  typography: theme.typography,
  shape: theme.shape,
  components: {
    ...theme.components,
    MuiTab: {
      styleOverrides: {
        root: {
          color: 'rgba(255,255,255,0.7)',
          '&.Mui-selected': {
            color: '#FDD023',
          },
        },
      },
    },
  },
});
