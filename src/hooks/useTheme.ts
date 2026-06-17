"use client";

import { useEffect, useState } from 'react';
import { PORTAL_THEMES } from '@/lib/themes';

export type ThemeMode = 'light' | 'dark' | 'system';

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';

  // If user has manually set a mode, respect it
  const saved = localStorage.getItem('portal-theme-mode') as ThemeMode | null;
  if (saved && (saved === 'light' || saved === 'dark' || saved === 'system')) {
    return saved;
  }

  // Otherwise derive from the saved portal theme
  const savedThemeId = localStorage.getItem('portal-theme-id') || 'midnight';
  const portalTheme = PORTAL_THEMES[savedThemeId];
  if (portalTheme?.isLight) return 'light';

  // Default to system preference
  return 'system';
}

export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getInitialMode());
  const [isDark, setIsDark] = useState(true);

  const applyMode = (mode: ThemeMode) => {
    let resolvedDark: boolean;
    if (mode === 'system') {
      resolvedDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      resolvedDark = mode === 'dark';
    }

    setIsDark(resolvedDark);

    const root = window.document.documentElement;
    if (resolvedDark) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  };

  useEffect(() => {
    applyMode(themeMode);
    localStorage.setItem('portal-theme-mode', themeMode);

    if (themeMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyMode('system');
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  /** Call this when the user picks a portal theme to auto-set dark/light */
  const syncToPortalTheme = (themeId: string) => {
    const t = PORTAL_THEMES[themeId];
    if (!t) return;
    // Only sync if the user hasn't explicitly overridden the mode
    // We store override in portal-theme-mode; clear it to re-derive
    localStorage.removeItem('portal-theme-mode');
    const newMode: ThemeMode = t.isLight ? 'light' : 'dark';
    localStorage.setItem('portal-theme-id', themeId);
    setThemeModeState(newMode);
  };

  return { themeMode, setThemeMode, isDark, syncToPortalTheme };
}
