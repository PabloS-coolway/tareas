import { useEffect, useState } from 'react';

export type Theme = 'violet' | 'midnight' | 'dark';
const KEY = 'etq-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) || 'midnight');

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.setAttribute('data-bs-theme', theme === 'dark' ? 'dark' : 'light'); // Bootstrap adapta sus componentes
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return { theme, setTheme };
}
