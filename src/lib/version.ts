import { useEffect, useState } from 'react';

/**
 * True once a newer deploy is live. Checked when the app opens and whenever it
 * comes back to the foreground, since a home-screen app can stay open for days.
 * Reloading is safe: your data lives in this browser, not in the page.
 */
export function useNewVersion(): boolean {
  const [newer, setNewer] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' });
        const { build } = (await res.json()) as { build?: string };
        if (build && build !== __BUILD__) setNewer(true);
      } catch {
        // Offline or no version file: keep running this version.
      }
    };
    void check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  return newer;
}
