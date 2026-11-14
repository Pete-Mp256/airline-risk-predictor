import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Light / dark theme. The choice is saved in localStorage; with no saved choice it follows the system.
// index.html applies the same rule before React loads, so the first paint already has the right theme.
const ThemeContext = createContext({ theme: 'light', setTheme: () => {}, toggleTheme: () => {} });

function readSaved() {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
}

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => readSaved() || systemTheme());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Follow system changes until the user picks a theme themselves.
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return undefined;
    const onChange = (e) => {
      if (!readSaved()) setThemeState(e.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Storage blocked (private window): the theme still applies for this visit.
    }
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
