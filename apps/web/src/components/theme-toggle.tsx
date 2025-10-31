import { useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

const FALLBACK_THEME: Theme = 'dark';

function resolveEnvironmentTheme(mediaQuery: MediaQueryList | null): Theme {
  if (typeof document !== 'undefined') {
    if (document.documentElement.classList.contains('dark')) {
      return 'dark';
    }
  }
  if (mediaQuery?.matches) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(FALLBACK_THEME);
  const [hydrated, setHydrated] = useState(false);
  const hasStoredPreference = useRef(false);

  const mediaQuery = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return window.matchMedia('(prefers-color-scheme: dark)');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = (() => {
      try {
        const value = window.localStorage.getItem('theme') as Theme | null;
        if (value === 'light' || value === 'dark') {
          return value;
        }
      } catch {
        // ignore storage access issues
      }
      return null;
    })();

    const nextTheme = stored ?? resolveEnvironmentTheme(mediaQuery);
    hasStoredPreference.current = Boolean(stored);

    setTheme(nextTheme);
    setHydrated(true);
  }, [mediaQuery]);

  useEffect(() => {
    if (!hydrated) return;
    applyTheme(theme);
    try {
      window.localStorage.setItem('theme', theme);
    } catch {
      // ignore persistence failures
    }
  }, [theme, hydrated]);

  useEffect(() => {
    if (!mediaQuery) return;
    const handler = (event: MediaQueryListEvent) => {
      if (hasStoredPreference.current) return;
      setTheme(event.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener?.('change', handler);
    return () => mediaQuery.removeEventListener?.('change', handler);
  }, [mediaQuery]);

  const isDark = theme === 'dark';
  const buttonLabel = hydrated
    ? isDark
      ? 'Switch to light mode'
      : 'Switch to dark mode'
    : 'Toggle theme';
  const sunClass = `h-4 w-4 transition-transform ${
    hydrated && isDark ? 'scale-0 -rotate-90' : 'scale-100 rotate-0'
  }`;
  const moonClass = `h-4 w-4 absolute transition-transform ${
    hydrated && isDark ? 'scale-100 rotate-0' : 'scale-0  rotate-90'
  }`;

  return (
    <button
      type="button"
      aria-label={buttonLabel}
      title={buttonLabel}
      onClick={() => {
        if (!hydrated) return;
        setTheme(prev => {
          const next = prev === 'dark' ? 'light' : 'dark';
          hasStoredPreference.current = true;
          return next;
        });
      }}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none"
    >
      <Sun className={sunClass} />
      <Moon className={moonClass} />
    </button>
  );
}
