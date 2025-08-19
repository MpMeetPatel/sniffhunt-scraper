import { chromium } from 'playwright-core';
import { BROWSER_OPTIONS } from '../config.js';
import { handleError } from '../utils/GlobalErrorHandler.js';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
  path: join(__dirname, '../../../.env'),
  quiet: true,
});

// Module-level state
let browser = null;
let page = null;

/**
 * Initialize browser and page
 * @returns {Promise<boolean>} Success status
 */
export async function initBrowser() {
  try {
    console.log('🚀 Initializing browser...');
    browser = await chromium.launch(BROWSER_OPTIONS);
    page = await browser.newPage({
      viewport: BROWSER_OPTIONS.viewport,
    });
    console.log('✅ Browser initialized successfully');
    return true;
  } catch (err) {
    await handleError(err, {
      operation: 'initBrowser',
      environment: 'local',
      browserType: 'chromium',
    });
    return false;
  }
}

/**
 * Get the current page instance
 * @returns {Object|null} Current page instance
 */
export function getPage() {
  return page;
}

/**
 * Get the current browser instance
 * @returns {Object|null} Current browser instance
 */
export function getBrowser() {
  return browser;
}

/**
 * Close browser and clean up
 * @returns {Promise<void>}
 */
export async function closeBrowser() {
  if (browser) {
    try {
      await browser.close();
      console.log('✅ Browser closed successfully');
    } catch (error) {
      console.error('⚠️ Error closing browser:', error.message);
    } finally {
      browser = null;
      page = null;
    }
  }
}
