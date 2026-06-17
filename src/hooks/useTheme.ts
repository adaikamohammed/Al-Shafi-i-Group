"use client";

import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('portal-theme-mode') as ThemeMode) || 'system';
    }
    return 'system';
  });

  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const applyThemeMode = () => {
      let resolvedDark = true;

      if (themeMode === 'system') {
        resolvedDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        resolvedDark = themeMode === 'dark';
      }

      setIsDark(resolvedDark);

      // Optionally sync with document element for global CSS / packages compatibility
      const root = window.document.documentElement;
      if (resolvedDark) {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
      }
    };

    applyThemeMode();
    localStorage.setItem('portal-theme-mode', themeMode);

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyThemeMode();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  return { themeMode, setThemeMode, isDark };
}
