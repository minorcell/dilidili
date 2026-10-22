import { useEffect } from 'react';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * 跟随系统浅色 / 深色外观，系统切换时同步到 <html class="dark">。
 * 应用内不提供手动切换入口。
 */
export function useSystemTheme() {
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const apply = () => document.documentElement.classList.toggle('dark', media.matches);

    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
}
