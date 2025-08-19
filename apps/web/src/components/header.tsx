// import { Link } from '@tanstack/react-router';
import { useStore } from '@tanstack/react-store';
import ThemeToggle from '@/components/theme-toggle';
import logoDark from '@/assets/logo.png';
import { scrapeModeStore } from '@/lib/scrapeModeStore';
import { Clock, Zap } from 'lucide-react';

export default function Header() {
  const mode = useStore(scrapeModeStore, s => s.mode);
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-[90%] items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex h-9 w-9 items-center justify-center rounded-sm overflow-hidden dark:border-[0.25px] dark:border-white/40">
            <img
              src={logoDark}
              alt="SniffHunt logo"
              className="h-full w-full object-contain"
            />
            {/* <img
              src={logoLight}
              alt="SniffHunt logo (dark)"
              className="hidden dark:block h-full w-full object-contain"
            /> */}
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">
              <span className="ml-1 text-foreground/90">SniffHunt Scraper</span>
            </div>
            {/* <div className="text-xs text-muted-foreground">
              Lightning‑fast, AI‑powered web content extraction
            </div> */}
            <div className="flex flex-wrap items-center gap-2 text-[8px]">
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-sky-600 dark:text-sky-400 border-sky-300/60 dark:border-sky-900/40">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                Live Status Updates
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-violet-600 dark:text-violet-400 border-violet-300/60 dark:border-violet-900/40">
                <Zap className="h-3 w-3" />
                AI Analysis & Extraction
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400 border-emerald-300/60 dark:border-emerald-900/40">
                <Clock className="h-3 w-3" />
                Multi‑phase Pipeline
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span
            className={
              `hidden sm:inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ` +
              (mode === 'beast'
                ? 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200/60 dark:border-fuchsia-900/40'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40')
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${mode === 'beast' ? 'bg-fuchsia-500' : 'bg-emerald-500'}`}
            />
            {mode === 'beast' ? 'Beast Mode' : 'Normal Mode'}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
