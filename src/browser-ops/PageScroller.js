/**
 * Continuously scrolls down until no new content is detected
 * Uses only Playwright native methods without page.evaluate()
 * @param {Object} page - Playwright page object
 * @param {Object} options - Configuration options
 * @returns {Promise<boolean>} - Success status
 */
async function infiniteScrollUntilNoMoreNewNetworkRequest(page, options = {}) {
  try {
    const {
      maxScrollAttempts = 10,
      scrollDelay = 500,
      networkIdleTimeout = 2000,
      stableChecks = 2,
      scrollStep = 3000, // Default scroll step in pixels
      containerSelector = 'body', // Container to check for content
    } = options;

    let consecutiveNoChangeCount = 0;
    let scrollAttempts = 0;
    let lastContentHash = '';
    let lastElementCount = 0;

    // Helper function to get content hash for comparison
    const getContentHash = async () => {
      try {
        // Get text content from body
        const textContent = (await page.textContent(containerSelector)) || '';

        // Count major elements using locators
        const imageCount = await page.locator('img').count();
        const linkCount = await page.locator('a').count();
        const divCount = await page.locator('div').count();
        const totalElements = imageCount + linkCount + divCount;

        // Create a simple hash from content
        return {
          hash: `${textContent.length}-${imageCount}-${linkCount}-${divCount}`,
          elementCount: totalElements,
          textLength: textContent.length,
        };
      } catch {
        return {
          hash: Date.now().toString(),
          elementCount: 0,
          textLength: 0,
        };
      }
    };

    // Helper function to check if we're at the bottom
    const isAtBottom = async () => {
      try {
        // Try to scroll down a little bit and see if position changes
        const beforeScroll = await page.evaluate(() => window.pageYOffset);

        // Small scroll attempt
        await page.mouse.wheel(0, 50);
        await page.waitForTimeout(100);

        const afterScroll = await page.evaluate(() => window.pageYOffset);

        // If we couldn't scroll, we're at the bottom
        return Math.abs(afterScroll - beforeScroll) < 5;
      } catch {
        return false;
      }
    };

    // Helper function to perform scroll
    const performScroll = async () => {
      try {
        if (scrollStep && typeof scrollStep === 'number') {
          // Scroll by specific amount using mouse wheel
          await page.mouse.wheel(0, scrollStep);
        } else {
          // Scroll to bottom using keyboard shortcut
          await page.keyboard.press('End');
        }
      } catch {
        // Fallback to mouse wheel
        await page.mouse.wheel(0, 1000);
      }
    };

    // Get initial state
    const initialContent = await getContentHash();
    lastContentHash = initialContent.hash;
    lastElementCount = initialContent.elementCount;

    while (scrollAttempts < maxScrollAttempts) {
      scrollAttempts++;
      console.log(`Scroll attempt ${scrollAttempts}/${maxScrollAttempts}`);

      // Perform the scroll
      await performScroll();

      // Wait for network to be idle
      try {
        await page.waitForLoadState('networkidle', {
          timeout: networkIdleTimeout,
        });
      } catch (timeoutError) {
        console.warn(
          'Network idle timeout, continuing...',
          timeoutError.message
        );
      }

      // Additional wait for dynamic content
      await page.waitForTimeout(scrollDelay);

      // Check for changes
      const currentContent = await getContentHash();
      const currentContentHash = currentContent.hash;
      const currentElementCount = currentContent.elementCount;

      const contentChanged = currentContentHash !== lastContentHash;
      const elementCountChanged = currentElementCount !== lastElementCount;
      const hasNewContent = contentChanged || elementCountChanged;

      if (hasNewContent) {
        consecutiveNoChangeCount = 0;
        lastContentHash = currentContentHash;
        lastElementCount = currentElementCount;
      } else {
        consecutiveNoChangeCount++;

        // Check if we're at the bottom of the page
        const atBottom = await isAtBottom();
        if (atBottom) {
          console.log(
            'Reached bottom of page, waiting for potential new content...'
          );

          // Wait a bit longer for any lazy loading
          await page.waitForTimeout(scrollDelay * 2);

          // Check one more time for new content
          const finalContent = await getContentHash();
          if (finalContent.hash === lastContentHash) {
            consecutiveNoChangeCount++;
          } else {
            consecutiveNoChangeCount = 0;
            lastContentHash = finalContent.hash;
            lastElementCount = finalContent.elementCount;
            console.log('Late-loading content detected, continuing...');
            continue;
          }
        }

        if (consecutiveNoChangeCount >= stableChecks) {
          console.log(
            'No new content detected after multiple stable checks, stopping'
          );
          break;
        }
      }

      // Small delay between scroll attempts
      await page.waitForTimeout(100);
    }

    // Final scroll to ensure we're at the bottom
    try {
      await page.keyboard.press('End');
      await page.waitForTimeout(500);
    } catch {
      // Ignore final scroll errors
    }

    return true;
  } catch (error) {
    console.error('Infinite scroll failed:', error.message);
    console.error(
      'Error details:',
      error.stack?.split('\n').slice(0, 3).join('\n')
    );
    return false;
  }
}

export default infiniteScrollUntilNoMoreNewNetworkRequest;
