// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  server: { port: 6002 },
  vite: { plugins: [tailwindcss()] },

  integrations: [
    starlight({
      favicon: '/favicon.png',
      title: 'SniffHunt',
      logo: {
        src: './src/assets/dark-logo.png',
        alt: 'SniffHunt Logo',
      },
      customCss: [
        // Path to your Tailwind base styles:
        './src/styles/global.css',
      ],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/mpmeetpatel/sniffhunt-scraper',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'index' },
            { label: 'Quick Start Guide', slug: 'quick-start' },
          ],
        },
        {
          label: 'Integration Methods',
          items: [
            { label: 'API Server', slug: 'api-server' },
            { label: 'MCP Integration', slug: 'mcp-integration' },
            { label: 'CLI Scraper', slug: 'cli-scraper' },
            { label: 'Web Interface', slug: 'web-ui' },
          ],
        },
      ],
    }),
  ],

  adapter: netlify(),
});
