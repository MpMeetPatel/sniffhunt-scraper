import dotenv from 'dotenv';
import { getKey } from './utils/KeyManager.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
  path: join(__dirname, '../../.env'),
  quiet: true,
});
// General configuration
export const MAX_RETRY_COUNT = parseInt(process.env.MAX_RETRY_COUNT, 10) || 2; // 2 retries
export const RETRY_DELAY = parseInt(process.env.RETRY_DELAY, 10) || 1000; // 1 second delay

// Browser args for all environments
const browserArgs = [
  // Security and sandboxing
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',

  // Performance optimizations
  '--disable-gpu',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=TranslateUI',
  '--disable-ipc-flooding-protection',

  // Visual rendering optimizations
  '--disable-extensions',
  '--disable-plugins',
  '--disable-default-apps',
  '--disable-sync',
  '--no-first-run',

  // Network optimizations
  '--aggressive-cache-discard',
  '--disable-background-networking',

  // Memory optimizations
  '--memory-pressure-off',
  '--disable-web-security', // Only for scraping

  // Disable DevTools and remote debugging to prevent port 3000 server
  '--disable-dev-tools',
  '--disable-remote-debugging',
  '--remote-debugging-port=0', // Disable remote debugging completely
];

// Browser options
export const BROWSER_OPTIONS = {
  headless: true,
  ignoreHTTPSErrors: true,
  args: browserArgs,
  viewport: {
    width: 1920,
    height: 1080,
  },
};

// Page navigation options
export const PAGE_OPTIONS = {
  waitUntil: 'networkidle',
  timeout: parseInt(process.env.PAGE_TIMEOUT, 10) || 10000, // 10 seconds
};

// LLM Model configuration
export const LLM_MODEL_CONFIG = {
  get apiKey() {
    try {
      return getKey() || '';
    } catch (error) {
      console.warn('Warning: Could not get API key:', error.message);
      return '';
    }
  },
  modelName: 'gemini-2.5-flash',
  smallModel: 'gemini-2.5-flash',
};
