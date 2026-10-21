import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'dilidili-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // 本地存储不可用时回退到跟随系统
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * 管理浅色 / 深色 / 跟随系统三种主题，并同步到 <html class="dark">。
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);
  const [isDark, setIsDark] = useState(() => {
    const stored = readStoredTheme();
    return stored === 'dark' || (stored === 'system' && systemPrefersDark());
  });

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      setIsDark(dark);
    };

    apply();

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // 本地存储不可用时仅在当前会话生效
    }

    if (theme === 'system') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }

    return undefined;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark]);

  return { theme, isDark, setTheme, toggleTheme };
}
