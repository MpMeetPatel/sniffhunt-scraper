import { Toaster } from '@/components/ui/sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/queryClient';

import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import Header from '../components/header';
import appCss from '../index.css?url';
import Loader from '@/components/loader';

export interface RouterAppContext {}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'SniffHunt Scraper',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});

function RootDocument() {
  const isFetching = useRouterState({ select: s => s.isLoading });

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=localStorage.getItem('theme');var isDark=s?s==='dark':true;var root=document.documentElement;if(isDark)root.classList.add('dark');else root.classList.remove('dark');}catch(e){}})();",
          }}
        />
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <div className="grid h-svh grid-rows-[auto_1fr]">
            <Header />
            {isFetching ? <Loader /> : <Outlet />}
          </div>
          <Toaster richColors />
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-right"
          />
          <TanStackRouterDevtools position="bottom-left" />
          <Scripts />
        </QueryClientProvider>
      </body>
    </html>
  );
}
