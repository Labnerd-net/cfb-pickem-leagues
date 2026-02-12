import { type ReactNode, useState } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme, lightTheme, lsuTheme } from '../../theme';
import { ThemeContext } from './ThemeContext';
import type { ThemeMode } from './ThemeContext';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Load theme preference from localStorage, default to dark
    const saved = localStorage.getItem('themeMode');
    return (saved === 'light' || saved === 'dark' || saved === 'lsu') ? saved : 'dark';
  });

  const toggleTheme = () => {
    setMode((prevMode) => {
      // Cycle through: dark -> light -> lsu -> dark
      const newMode = prevMode === 'dark' ? 'light' : prevMode === 'light' ? 'lsu' : 'dark';
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  const currentTheme = mode === 'light' ? lightTheme : mode === 'lsu' ? lsuTheme : theme;

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <MuiThemeProvider theme={currentTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
