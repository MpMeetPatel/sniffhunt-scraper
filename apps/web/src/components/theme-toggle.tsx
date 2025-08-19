import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  const hasClass = document.documentElement.classList.contains('dark');
  return hasClass ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  // Ensure state matches current DOM theme before paint to avoid icon mismatch
  useLayoutEffect(() => {
    const current: Theme = document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';
    setTheme(current);
  }, []);

  // Listen for system changes only if user hasn't explicitly chosen
  const mediaQuery = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.matchMedia('(prefers-color-scheme: dark)');
  }, []);

  useEffect(() => {
    // If there is a stored preference, honor it; otherwise keep current
    try {
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored === 'light' || stored === 'dark') {
        setTheme(stored);
        applyTheme(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist and apply when theme changes
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // If user clears preference, follow system changes (not exposed in UI now but keep future-proof)
  useEffect(() => {
    if (!mediaQuery) return;
    const handler = () => {
      try {
        const stored = localStorage.getItem('theme');
        if (stored !== 'light' && stored !== 'dark') {
          const next: Theme = mediaQuery.matches ? 'dark' : 'light';
          setTheme(next);
        }
      } catch {
        // ignore
      }
    };
    mediaQuery.addEventListener?.('change', handler as EventListener);
    return () =>
      mediaQuery.removeEventListener?.('change', handler as EventListener);
  }, [mediaQuery]);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none"
    >
      <Sun
        className={`h-4 w-4 transition-transform ${isDark ? 'scale-0 -rotate-90' : 'scale-100 rotate-0'}`}
      />
      <Moon
        className={`h-4 w-4 absolute transition-transform ${isDark ? 'scale-100 rotate-0' : 'scale-0  rotate-90'}`}
      />
    </button>
  );
}
