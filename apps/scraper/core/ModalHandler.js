/**
 * Modal detection and handling utilities for web scraping
 * Handles modal detection, scroll blocking detection, and modal dismissal
 */

/**
 * Detects if scrolling is blocked on the current page using multiple techniques
 * @param {import('playwright').Page} page - The Playwright page object
 * @returns {Promise<boolean>} True if scrolling appears to be blocked
 */
export async function isScrollingBlocked(page) {
  return await page.evaluate(() => {
    // Cache original values to restore later
    const originalScrollTop =
      document.documentElement.scrollTop || document.body.scrollTop;

    // Test 1: Check if document is scrollable at all
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    const docWidth = Math.max(
      document.body.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.clientWidth,
      document.documentElement.scrollWidth,
      document.documentElement.offsetWidth
    );

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const hasVerticalScrollContent = docHeight > viewportHeight;
    const hasHorizontalScrollContent = docWidth > viewportWidth;

    // If no scrollable content exists, scrolling is effectively "blocked"
    if (!hasVerticalScrollContent && !hasHorizontalScrollContent) {
      return true;
    }

    // Test 2: Simulate wheel event to detect if scroll events are being prevented
    let wheelEventBlocked = false;
    // eslint-disable-next-line no-unused-vars
    let wheelEventFired = false;

    const testWheelEvent = e => {
      wheelEventFired = true;
      if (e.defaultPrevented) {
        wheelEventBlocked = true;
      }
    };

    // Add temporary listener
    document.addEventListener('wheel', testWheelEvent, { passive: false });

    // Create and dispatch a synthetic wheel event
    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 100,
      deltaMode: 0,
      bubbles: true,
      cancelable: true,
    });

    // Target the deepest scrollable element or document
    const targetElement =
      document.elementFromPoint(viewportWidth / 2, viewportHeight / 2) ||
      document.documentElement;

    targetElement.dispatchEvent(wheelEvent);

    // Clean up listener
    document.removeEventListener('wheel', testWheelEvent);

    // Test 3: Check computed styles that commonly block scrolling
    const htmlStyles = getComputedStyle(document.documentElement);
    const bodyStyles = getComputedStyle(document.body);

    const htmlOverflow = htmlStyles.overflow;
    const htmlOverflowY = htmlStyles.overflowY;
    const bodyOverflow = bodyStyles.overflow;
    const bodyOverflowY = bodyStyles.overflowY;

    const hasHiddenOverflow =
      htmlOverflow === 'hidden' ||
      htmlOverflowY === 'hidden' ||
      bodyOverflow === 'hidden' ||
      bodyOverflowY === 'hidden';

    // Test 4: Attempt a minimal scroll position change and check if it takes effect
    let scrollTestBlocked = false;

    if (hasVerticalScrollContent) {
      const testScrollY = originalScrollTop + (originalScrollTop > 0 ? -1 : 1);
      const maxScrollY = docHeight - viewportHeight;

      if (testScrollY >= 0 && testScrollY <= maxScrollY) {
        // Use requestAnimationFrame to ensure we're testing after any scroll blocking mechanisms
        const testScroll = () => {
          const beforeScroll =
            document.documentElement.scrollTop || document.body.scrollTop;

          // Simulate user scroll by temporarily adjusting scroll position
          if (document.documentElement.scrollTop !== undefined) {
            document.documentElement.scrollTop = testScrollY;
          } else {
            document.body.scrollTop = testScrollY;
          }

          const afterScroll =
            document.documentElement.scrollTop || document.body.scrollTop;

          // Restore original position immediately
          if (document.documentElement.scrollTop !== undefined) {
            document.documentElement.scrollTop = originalScrollTop;
          } else {
            document.body.scrollTop = originalScrollTop;
          }

          // If scroll position didn't change, scrolling is blocked
          scrollTestBlocked =
            beforeScroll === afterScroll && beforeScroll !== testScrollY;
        };

        testScroll();
      }
    }

    // Test 5: Check for touch-action CSS property that prevents scrolling
    const hasTouchActionNone = (() => {
      const htmlTouchAction = htmlStyles.touchAction;
      const bodyTouchAction = bodyStyles.touchAction;
      return htmlTouchAction === 'none' || bodyTouchAction === 'none';
    })();

    // Test 6: Check if body/html has height constraints that prevent scrolling
    const hasHeightConstraints = (() => {
      const htmlHeight = htmlStyles.height;
      const bodyHeight = bodyStyles.height;
      const htmlMaxHeight = htmlStyles.maxHeight;
      const bodyMaxHeight = bodyStyles.maxHeight;

      return (
        ((htmlHeight === '100%' || htmlHeight === '100vh') &&
          (bodyHeight === '100%' || bodyHeight === '100vh') &&
          hasHiddenOverflow) ||
        htmlMaxHeight === '100vh' ||
        bodyMaxHeight === '100vh'
      );
    })();

    // Combine all test results
    const isBlocked =
      wheelEventBlocked ||
      (hasVerticalScrollContent && hasHiddenOverflow) ||
      (hasVerticalScrollContent && scrollTestBlocked) ||
      hasTouchActionNone ||
      hasHeightConstraints;

    return isBlocked;
  }, {});
}

/**
 * Finds modal elements on a page using criteria from test4.js
 * @param {import('playwright').Page} page - The Playwright page object
 * @returns {Promise<Array>} Array of modal elements with their bounding boxes
 */
export async function findModals(page) {
  return await page.evaluate(() => {
    /**
     * Builds an XPath for a given DOM Element, handling all edge cases
     * @param {Element} element - The DOM Element
     * @returns {string} - The XPath string for the element
     */
    function getXPath(element) {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        throw new Error('Invalid element: must be a valid DOM Element');
      }

      if (element === document.documentElement) {
        return '/html';
      }

      if (element === document.body) {
        return '/html/body';
      }

      if (!element.parentNode) {
        throw new Error('Cannot build XPath for orphaned element');
      }

      const escapeXPath = str => {
        if (str.includes("'") && str.includes('"')) {
          const parts = str.split("'").map(part => `'${part}'`);
          return `concat(${parts.join(', "\'", ')})`;
        } else if (str.includes("'")) {
          return `"${str}"`;
        } else {
          return `'${str}'`;
        }
      };

      // Helper to test uniqueness of an XPath
      const isXPathUnique = xpath => {
        try {
          const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          return result.snapshotLength === 1;
        } catch (error) {
          console.warn('Error checking XPath uniqueness', error);
          return false;
        }
      };

      // Method 1: Try ID first (most reliable)
      if (element.id && element.id.trim()) {
        const idXPath = `//*[@id=${escapeXPath(element.id)}]`;
        if (isXPathUnique(idXPath)) {
          return idXPath;
        }
      }

      // Method 2: Try combination of tag + unique attributes
      const tagName = element.tagName.toLowerCase();
      const attributes = [];

      // Collect significant attributes
      if (element.className && typeof element.className === 'string') {
        const classes = element.className
          .trim()
          .split(/\s+/)
          .filter(c => c.length > 0);
        if (classes.length > 0) {
          // Try each class individually for uniqueness
          for (const cls of classes) {
            const classXPath = `//${tagName}[@class="${cls}"]`;
            if (isXPathUnique(classXPath)) {
              return classXPath;
            }
          }
          // If no single class is unique, use all classes
          attributes.push(`@class=${escapeXPath(element.className)}`);
        }
      }

      // Add other unique attributes
      const uniqueAttrs = [
        'name',
        'data-testid',
        'data-id',
        'aria-label',
        'title',
        'role',
        'type',
      ];
      for (const attr of uniqueAttrs) {
        const value = element.getAttribute(attr);
        if (value && value.trim()) {
          attributes.push(`@${attr}=${escapeXPath(value)}`);
        }
      }

      // Method 3: Try tag + attribute combinations
      if (attributes.length > 0) {
        // Try each attribute individually
        for (const attr of attributes) {
          const attrXPath = `//${tagName}[${attr}]`;
          if (isXPathUnique(attrXPath)) {
            return attrXPath;
          }
        }

        // Try combinations of attributes
        if (attributes.length > 1) {
          const combinedXPath = `//${tagName}[${attributes.join(' and ')}]`;
          if (isXPathUnique(combinedXPath)) {
            return combinedXPath;
          }
        }
      }

      // Method 4: Try text content for uniqueness
      const textContent = element.textContent?.trim();
      if (textContent && textContent.length > 0 && textContent.length < 50) {
        const textXPath = `//${tagName}[text()=${escapeXPath(textContent)}]`;
        if (isXPathUnique(textXPath)) {
          return textXPath;
        }

        // Try contains for partial text match
        const containsXPath = `//${tagName}[contains(text(), ${escapeXPath(
          textContent
        )})]`;
        if (isXPathUnique(containsXPath)) {
          return containsXPath;
        }
      }

      // Method 5: Use position among ALL siblings (not just same tag)
      const allSiblings = Array.from(element.parentNode.children);
      const position = allSiblings.indexOf(element) + 1;
      const parentPath = getXPath(element.parentNode);

      const positionXPath = `${parentPath}/*[${position}]`;
      if (isXPathUnique(positionXPath)) {
        return positionXPath;
      }

      // Method 6: Fall back to tag + position among same-tag siblings (original method)
      const siblings = Array.from(element.parentNode.children).filter(
        child => child.tagName === element.tagName
      );

      if (siblings.length === 1) {
        return `${parentPath}/${tagName}`;
      } else {
        const index = siblings.indexOf(element) + 1;
        return `${parentPath}/${tagName}[${index}]`;
      }
    }

    const MIN_SIZE_PX = 50;
    const MIN_VIEWPORT_AREA_PERCENTAGE = 0.02;

    const candidateSelector = 'div, section, span, dialog, svg';
    const candidateElements = document.querySelectorAll(candidateSelector);
    const viewportArea = window.innerWidth * window.innerHeight;

    const finalElements = Array.from(candidateElements).reduce((acc, el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const tagName = el.tagName.toLowerCase();

      // Special handling for dialog elements
      if (tagName === 'dialog') {
        // Check if dialog is open
        if (!el.hasAttribute('open')) {
          return acc;
        }

        // For dialogs, we don't need to check z-index or positioning as they have native modal behavior
        const isVisibleOnScreen =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity > 0 &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0;

        if (!isVisibleOnScreen) {
          return acc;
        }

        const elementArea = rect.width * rect.height;
        const minimumArea = viewportArea * MIN_VIEWPORT_AREA_PERCENTAGE;

        const meetsMinimumSize =
          rect.width >= MIN_SIZE_PX && rect.height >= MIN_SIZE_PX;
        const isLargeEnough = elementArea >= minimumArea && meetsMinimumSize;

        if (isLargeEnough) {
          const xpath = getXPath(el);

          acc.push({
            element: el,
            xpath: xpath,
            position: 'dialog', // Special marker for dialog elements
            zIndex: {
              rawZIndex: 'auto',
              isNaN: false,
              zIndex: 999999, // Dialogs have highest priority
            },
            isDialog: true,
          });
        }

        return acc;
      }

      // Regular modal detection logic for non-dialog elements
      // Condition 2: Check z-index must be a number > 10 OR element must be fixed positioned
      const rawZIndex = style.zIndex;
      const zIndex = parseInt(rawZIndex, 10);

      if (
        zIndex <= 1 ||
        (style.position !== 'fixed' && style.position !== 'absolute')
      ) {
        return acc;
      }

      const isVisibleOnScreen =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity > 0 &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0;

      if (!isVisibleOnScreen) {
        return acc;
      }

      const elementArea = rect.width * rect.height;
      const minimumArea = viewportArea * MIN_VIEWPORT_AREA_PERCENTAGE;

      const meetsMinimumSize =
        rect.width >= MIN_SIZE_PX && rect.height >= MIN_SIZE_PX;
      const isLargeEnough = elementArea >= minimumArea && meetsMinimumSize;

      if (isLargeEnough) {
        // Generate a unique selector for the element
        // build xpath selector
        const xpath = getXPath(el);

        acc.push({
          element: el,
          xpath: xpath,
          position: style.position,
          zIndex: {
            rawZIndex: rawZIndex,
            isNaN: isNaN(zIndex),
            zIndex: zIndex,
          },
          isDialog: false,
        });
      }

      return acc;
    }, []);

    return finalElements;
  }, {});
}

/**
 * Attempts to close modals using various methods (outside click, escape key, close buttons)
 * @param {import('playwright').Page} page - The Playwright page object
 * @param {Array} modals - Array of modal objects from findModals
 * @returns {Promise<boolean>} True if modals were successfully closed
 */
export async function closeModals(page, modals) {
  // Helper function to compare arrays
  const arraysEqualEvery = (arr1, arr2) => {
    return (
      arr1.length === arr2.length && arr1.every((val, i) => val === arr2[i])
    );
  };

  // Helper function to check modal visibility
  const checkModalVisibility = async modals => {
    if (!modals || modals?.length === 0) {
      return [];
    }

    return await Promise.all(
      modals.map(modal => page.locator(`xpath=${modal.xpath}`).isVisible())
    );
  };

  if (!modals || modals.length === 0) {
    return true; // No modals to close
  }

  const initialModalState = await checkModalVisibility(modals);
  // Try dismissing modal with outside click
  try {
    await page.click('html', { delay: 100, force: true });
    await page.waitForTimeout(100);

    const modalStateAfterOutsideClick = await checkModalVisibility(modals);
    const modalDismissed = !arraysEqualEvery(
      initialModalState,
      modalStateAfterOutsideClick
    );

    if (modalDismissed) return true;
  } catch {
    // Ignore outside click errors
  }

  // Try dismissing modal with Escape key
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    const modalStateAfterEscape = await checkModalVisibility(modals);
    const modalDismissed = !arraysEqualEvery(
      initialModalState,
      modalStateAfterEscape
    );

    if (modalDismissed) return true;
  } catch {
    // Ignore escape key errors
  }

  // Helper function to find close buttons within modals
  const findCloseButtons = async modals => {
    const closeButtonArrays = await Promise.all(
      modals.map(async modal => {
        const base = page.locator(`xpath=${modal.xpath}`);

        // Look for actual close buttons with specific patterns
        const [
          closeRoleButtons,
          cancelRoleButtons,
          closeLabels,
          cancelLabels,
          dismissLabels,
          xButtons,
          closeTextButtons,
          cancelTextButtons,
        ] = await Promise.all([
          base.getByRole('button', { name: /^close$/i }).elementHandles(),
          base.getByRole('button', { name: /^cancel$/i }).elementHandles(),
          base.getByLabel(/^close$/i).elementHandles(),
          base.getByLabel(/^cancel$/i).elementHandles(),
          base.getByLabel(/^dismiss$/i).elementHandles(),
          base.getByText(/^[×✕x]$/).elementHandles(), // Only exact matches for X symbols
          base.getByText(/^close$/i).elementHandles(),
          base.getByText(/^cancel$/i).elementHandles(),
        ]);

        return [
          ...new Set([
            ...closeRoleButtons,
            ...cancelRoleButtons,
            ...closeLabels,
            ...cancelLabels,
            ...dismissLabels,
            ...xButtons,
            ...closeTextButtons,
            ...cancelTextButtons,
          ]),
        ];
      })
    );
    return closeButtonArrays.flat();
  };

  // Try dismissing modal with close buttons
  try {
    const closeButtons = await findCloseButtons(modals);
    for (const closeButton of closeButtons) {
      try {
        if (
          !(await closeButton.isVisible()) ||
          !(await closeButton.isEnabled())
        ) {
          continue;
        }
        await closeButton.click({ delay: 100, force: true });
        await page.waitForTimeout(100);

        const modalStateAfterClose = await checkModalVisibility(modals);
        const modalDismissed = !arraysEqualEvery(
          initialModalState,
          modalStateAfterClose
        );

        if (modalDismissed) return true;
      } catch {
        // Ignore close button click errors (element may be detached)
      }
    }
  } catch {
    // Ignore close button finding errors
  }

  // Last resort: Try dismissing modal with hide method
  // Don't destroy the modal, just add display: none
  try {
    await Promise.all(
      modals.map(async modal => {
        const modalElement = page.locator(`xpath=${modal.xpath}`);
        if (await modalElement.isVisible()) {
          await modalElement.evaluate(el => (el.style.display = 'none'));
        }
      })
    );

    const modalStateAfterDestroy = await checkModalVisibility(modals);
    const modalDismissed = !arraysEqualEvery(
      initialModalState,
      modalStateAfterDestroy
    );

    if (modalDismissed) return true;
  } catch (error) {
    console.log('Error dismissing modal with hide method:', error);
  }

  return false; // Could not close modals
}
