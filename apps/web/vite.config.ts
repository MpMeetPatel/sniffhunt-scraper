import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    port: 6001, // Explicitly set the port to match package.json script
  },
  plugins: [tsconfigPaths(), tailwindcss(), tanstackStart({})],
});
