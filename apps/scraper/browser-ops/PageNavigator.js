import { PAGE_OPTIONS } from '../config.js';
import { handleError } from '../utils/GlobalErrorHandler.js';
import {
  closeModals,
  findModals,
  isScrollingBlocked,
} from '../core/ModalHandler.js';

/**
 * Navigate to URL and wait for page to stabilize
 * @param {Object} page - Playwright page object
 * @param {string} url - The URL to scrape
 * @returns {Promise<boolean>} - Success status
 */
export async function navigateToUrl(page, url) {
  try {
    const BLOCKED_RESOURCE_TYPES = ['media', 'font']; // 'media' covers audio and video

    await page.route('**/*', route => {
      if (BLOCKED_RESOURCE_TYPES.includes(route.request().resourceType())) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(url, PAGE_OPTIONS);
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    const scrollingBlocked = await isScrollingBlocked(page);
    if (scrollingBlocked) {
      await page.keyboard.press('Escape', { delay: 10 });
      await page.click('html', { delay: 100, force: true });
      await page.waitForTimeout(500);
    } else {
      await page.waitForTimeout(500);
    }

    const modals = await findModals(page);
    const modalsClosed = await closeModals(page, modals);

    // Only log if there were issues with modals
    if (modals.length > 0 && !modalsClosed) {
      console.warn(`Could not close ${modals.length} modal(s)`);
    }

    return true;
  } catch (error) {
    await handleError(error, {
      operation: 'navigateToUrl',
      url,
      pageOptions: PAGE_OPTIONS,
    });
    return false;
  }
}
