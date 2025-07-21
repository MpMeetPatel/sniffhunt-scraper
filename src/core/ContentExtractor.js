import { handleError } from '../utils/GlobalErrorHandler.js';

/**
 * Extract raw HTML content from the page without any removal or cleaning
 * @param {Object} page - Playwright page object
 * @returns {Promise<string>} - The raw HTML content
 */
export async function extractMainContent(page) {
  try {
    // Simply return the raw HTML without any modifications
    const mainContent = await page.evaluate(() => {
      return document.documentElement.outerHTML;
    }, {});

    return mainContent || '';
  } catch (error) {
    await handleError(error, {
      operation: 'extractMainContent',
    });
    return '';
  }
}
