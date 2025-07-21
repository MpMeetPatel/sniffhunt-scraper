import { handleError } from '../utils/GlobalErrorHandler.js';

/**
 * Combines main HTML content with dynamic content extracted from interactions
 * @param {Object} page - Playwright page object
 * @param {Array<Object>} dynamicContents - Array of dynamic content objects
 * @returns {Promise<string>} - Combined HTML content
 */
export async function combineContent(page, dynamicContents) {
  try {
    // If no dynamic content, return current page content
    if (
      !dynamicContents ||
      !Array.isArray(dynamicContents) ||
      dynamicContents.length === 0
    ) {
      await page.evaluate(() => {
        // after processing, remove junk from html like script tags, style tags, etc.
        document
          .querySelectorAll('script, style')
          .forEach(element => element.remove());

        // Remove all attributes except for table and its children attributes, iframe content or code/pre tags & it's children
        document.querySelectorAll('*').forEach(element => {
          // Don't remove from iframe content or code/pre tags & it's children
          if (
            element.tagName === 'IFRAME' ||
            element.tagName === 'CODE' ||
            element.tagName === 'PRE'
          ) {
            return;
          }

          if (element.tagName !== 'TABLE' && !element.closest('table')) {
            Array.from(element.attributes).forEach(attr => {
              if (
                attr.name !== 'class' &&
                attr.name !== 'id' &&
                !attr.name.startsWith('data-') &&
                !attr.name.startsWith('aria-')
              ) {
                element.removeAttribute(attr.name);
              }
            });
          }
        });
      });
      return await page.content();
    }

    // Manipulate the page DOM directly
    await page.evaluate(
      config => {
        // Process each dynamic content item
        for (const dynamicItem of config.dynamicContents) {
          try {
            const { revealedHTML, position } = dynamicItem;

            if (!revealedHTML || !position) {
              continue;
            }

            // Parse the revealed HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = revealedHTML;
            const revealedElement = tempDiv.firstElementChild;

            if (!revealedElement) {
              continue;
            }

            let targetElement = null;

            // Strategy 1: Try XPath if available
            if (position.xpath) {
              try {
                const xpathResult = document.evaluate(
                  position.xpath,
                  document,
                  null,
                  XPathResult.FIRST_ORDERED_NODE_TYPE,
                  null
                );
                if (xpathResult.singleNodeValue) {
                  targetElement = xpathResult.singleNodeValue;
                }
              } catch (xpathError) {
                console.warn(
                  `XPath lookup failed: ${position.xpath}`,
                  xpathError.message
                );
              }
            }

            // Strategy 2: Try CSS path if XPath failed
            if (!targetElement && position.cssPath) {
              try {
                targetElement = document.querySelector(position.cssPath);
                if (targetElement) {
                  console.log('CSS path found:', position.cssPath);
                }
              } catch (cssError) {
                console.warn(
                  `CSS path lookup failed: ${position.cssPath}`,
                  cssError.message
                );
              }
            }

            // Strategy 3: Try to find by element properties if paths failed
            if (!targetElement && position.boundingRect) {
              const allElements = document.getElementsByTagName('*');
              const candidates = [];

              for (const element of allElements) {
                // Skip if element already has dynamic content
                if (element.hasAttribute('data-dynamic-content')) {
                  continue;
                }

                // Match by tag name and other characteristics
                if (revealedElement.tagName === element.tagName) {
                  let score = 0;

                  // Check text content similarity
                  const elementText = element.textContent?.trim() || '';
                  const revealedText =
                    revealedElement.textContent?.trim() || '';

                  if (
                    elementText &&
                    revealedText &&
                    elementText === revealedText
                  ) {
                    score += 3;
                  }

                  // Check class similarity
                  if (element.className && revealedElement.className) {
                    const elementClasses = new Set(
                      element.className
                        .split(/\s+/)
                        .filter(cls => cls.length > 0)
                    );
                    const revealedClasses = new Set(
                      revealedElement.className
                        .split(/\s+/)
                        .filter(cls => cls.length > 0)
                    );
                    const intersection = new Set(
                      [...elementClasses].filter(x => revealedClasses.has(x))
                    );
                    if (intersection.size > 0) {
                      score += intersection.size;
                    }
                  }

                  // Check ID similarity
                  if (
                    element.id &&
                    revealedElement.id &&
                    element.id === revealedElement.id
                  ) {
                    score += 5;
                  }

                  if (score > 0) {
                    candidates.push({ element, score });
                  }
                }
              }

              // Sort candidates by score and pick the best one
              if (candidates.length > 0) {
                candidates.sort((a, b) => b.score - a.score);
                targetElement = candidates[0].element;
              }
            }

            // Strategy 4: Fallback - insert at the end of body if no target found
            if (!targetElement) {
              targetElement = document.body;
            }

            // Insert the dynamic content
            if (targetElement && revealedElement) {
              // Mark the revealed element as dynamic content
              revealedElement.setAttribute('data-dynamic-content', 'true');
              revealedElement.setAttribute(
                'data-interaction-type',
                dynamicItem.interactionType || 'unknown'
              );
              revealedElement.setAttribute(
                'data-selector',
                dynamicItem.selector || 'unknown'
              );

              // Determine insertion strategy based on target element
              if (targetElement === document.body) {
                // Append to body as fallback
                targetElement.appendChild(revealedElement);
              } else {
                // Check if the target element is empty or should be replaced
                const targetText = targetElement.textContent?.trim() || '';
                const revealedText = revealedElement.textContent?.trim() || '';

                if (
                  targetText === revealedText ||
                  targetElement.children.length === 0
                ) {
                  // Replace the target element's content
                  targetElement.innerHTML = '';
                  targetElement.appendChild(revealedElement);
                } else {
                  // Insert revealed content as a sibling after the target element
                  const wrapper = document.createElement('div');
                  wrapper.className = 'dynamic-content-wrapper';
                  wrapper.appendChild(revealedElement);
                  targetElement.parentNode.insertBefore(
                    wrapper,
                    targetElement.nextSibling
                  );
                }
              }
            }
          } catch (itemError) {
            console.warn(
              'Error processing dynamic content item:',
              itemError.message
            );
          }
        }
      },
      { dynamicContents }
    );

    // After processing dynamic content, clean up the DOM (moved outside of nested page.evaluate)
    await page.evaluate(() => {
      // after processing, remove junk from html like script tags, style tags, etc.
      document
        .querySelectorAll('script, style')
        .forEach(element => element.remove());

      // Remove all attributes except for table and its children attributes, iframe content or code/pre tags & it's children
      document.querySelectorAll('*').forEach(element => {
        // Don't remove from iframe content or code/pre tags & it's children
        if (
          element.tagName === 'IFRAME' ||
          element.tagName === 'CODE' ||
          element.tagName === 'PRE'
        ) {
          return;
        }

        if (element.tagName !== 'TABLE' && !element.closest('table')) {
          Array.from(element.attributes).forEach(attr => {
            if (
              attr.name !== 'class' &&
              attr.name !== 'id' &&
              !attr.name.startsWith('data-') &&
              !attr.name.startsWith('aria-')
            ) {
              element.removeAttribute(attr.name);
            }
          });
        }
      });
    });

    return await page.content();
  } catch (error) {
    const handledError = await handleError(error, {
      operation: 'combineContent',
      dynamicContentCount: dynamicContents ? dynamicContents.length : 0,
    });

    // Return current page content as fallback
    try {
      return await page.content();
    } catch (fallbackError) {
      await handleError(fallbackError, {
        operation: 'combineContent_fallback',
        originalError: handledError.stackId,
      });
      return '';
    }
  }
}
