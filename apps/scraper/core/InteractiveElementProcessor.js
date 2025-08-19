import dotenv from 'dotenv';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamObject } from 'ai';
import { z } from 'zod';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { closeModals, findModals, isScrollingBlocked } from './ModalHandler.js';
import { generateHTMLAnalysisPrompt } from '../utils/AIPrompts.js';
import { handleError } from '../utils/GlobalErrorHandler.js';
import { LLM_MODEL_CONFIG } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
  path: join(__dirname, '../../../.env'),
  quiet: true,
});

// Pre-compile schemas for better performance
const InteractiveElementSchema = z.object({
  selector: z
    .string()
    .describe(
      'CSS selector that uniquely identifies the interactive element on the page.'
    ),
  textContent: z
    .string()
    .describe('The text content of the interactive element.'),
  interactionType: z
    .string()
    .describe(
      'Type of interaction that should be performed on the element to reveal hidden content.'
    ),
  reason: z
    .string()
    .min(20)
    .describe(
      "A clear explanation of why this element is likely to reveal additional content when interacted with. Include details about the element's purpose and expected behavior."
    ),
});

const InteractiveElementsSchema = z.object({
  interactionNeeded: z
    .enum(['YES', 'NO'])
    .describe(
      'YES if there are hidden/dynamic content areas that require interaction to reveal. ' +
        'NO if all relevant content is already visible in the current HTML or if no interactive elements exist that would reveal valuable hidden content.'
    ),
  analysis: z
    .string()
    .describe(
      "Brief explanation of why interaction is or isn't needed based on the page analysis."
    ),
  elements: z
    .array(InteractiveElementSchema)
    .describe(
      'An array of interactive elements that should be triggered to reveal hidden content. ' +
        'Elements should be ordered by their likelihood of revealing valuable content. ' +
        'This array should be empty if interactionNeeded is NO or no promising interactive elements are found.'
    ),
});

/**
 * Cleanup method to prevent memory leaks
 * @param {Object} page - Playwright page object
 */
async function cleanup(page) {
  await page.evaluate(() => {
    if (window.interactionTracker) {
      window.interactionTracker.cleanup();
      delete window.interactionTracker;
    }
  }, {});
}

/**
 * Stream AI analysis with progress indicators
 * @param {string} htmlContent - The HTML content to analyze
 * @param {string} userQuery - Optional user query for specific content
 * @param {Function} progressCallback - Optional progress callback for streaming updates
 * @returns {Promise<{object: Object}>} - The complete AI analysis result
 */
async function _streamAIAnalysis(
  htmlContent,
  userQuery = '',
  progressCallback = null
) {
  // Helper function to log with streaming support
  const logWithStreaming = (message, level = 'info') => {
    console.log(
      `${level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '🤖'} ${message}`
    );
    if (progressCallback) {
      progressCallback({
        type: 'log',
        level,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  console.log('🤖 AI Analysis ongoing...');

  const google = createGoogleGenerativeAI({
    apiKey: LLM_MODEL_CONFIG.apiKey,
  });

  // Track streaming progress
  let streamingComplete = false;
  let completeResult = null;

  try {
    const { partialObjectStream } = await streamObject({
      model: google('gemini-2.5-flash'), // Use specific model for better structured output
      schema: InteractiveElementsSchema,
      prompt: generateHTMLAnalysisPrompt(htmlContent, userQuery),
      temperature: 0.9, // Lower temperature for more consistent structured output
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 2048,
          },
        },
      },
      onFinish: result => {
        streamingComplete = true;
        completeResult = result.object;
        console.log('Usage Tokens:', JSON.stringify(result.usage, null, 2));
      },
    });

    for await (const _ of partialObjectStream) {
      console.log('🤖 AI Analysis generating JSON response...');
    }

    while (!streamingComplete) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Ensure elements array exists
    if (!Array.isArray(completeResult.elements)) {
      completeResult.elements = [];
    }

    return { object: completeResult };
  } catch (error) {
    console.error('🚨 AI Analysis Error Details:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);

    // Check for specific AI SDK errors
    if (
      error.name === 'AI_NoObjectGeneratedError' ||
      error.name === 'NoObjectGeneratedError'
    ) {
      console.error('🔍 AI returned text instead of structured object:');
      console.error('Response text:', error.text);
      console.error('Expected: JSON object matching InteractiveElementsSchema');
      console.error('Actual: Plain text response');

      // Try to parse the response manually if it's a simple YES/NO
      if (error.text && typeof error.text === 'string') {
        const responseText = error.text.trim().replace(/"/g, '');
        if (responseText === 'YES' || responseText === 'NO') {
          console.log(
            '🔧 Attempting manual recovery from simple text response...'
          );
          const fallbackResult = {
            interactionNeeded: responseText,
            analysis:
              'AI returned simple text response instead of structured object. Manual recovery applied.',
            elements: [],
          };
          logWithStreaming(
            `AI analysis recovered from error. Result: ${responseText}`,
            'warn'
          );
          return { object: fallbackResult };
        }
      }
    }

    logWithStreaming(`AI analysis failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Find interactive elements like buttons, dropdowns, etc. that might reveal hidden content
 * @param {string} clonedHTML - The HTML content to analyze
 * @param {string} userQuery - Optional user query for specific content to focus on
 * @param {Function} progressCallback - Optional progress callback for streaming updates
 * @returns {Promise<Object>} - Object containing analysis and array of interactive elements
 */
export async function findInteractiveElements(
  clonedHTML,
  userQuery = '',
  progressCallback = null
) {
  // Use streaming for better user experience
  const result = await _streamAIAnalysis(
    clonedHTML,
    userQuery,
    progressCallback
  );

  if (result.object.interactionNeeded === 'NO') {
    console.log('✅ No interaction needed based on AI analysis');
    console.log(`📊 AI Reasoning: ${result.object.analysis}`);
    return { elements: [] };
  }

  console.log(
    `🎯 Found ${result.object.elements.length} interactive elements to process`
  );

  return result.object;
}

/**
 * Setup mutation observer to track DOM changes
 * @param {Object} page - Playwright page object
 */
async function _setupMutationObserver(page) {
  await page.evaluate(() => {
    if (window.interactionTracker) {
      window.interactionTracker.cleanup();
    }

    window.interactionTracker = {
      changes: [],
      observer: null,

      cleanup() {
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }
        this.changes = [];
      },

      init() {
        this.cleanup();

        // Create mutation observer to track DOM changes
        this.observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
              // Track added nodes
              mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const xpath = this.getXPath(node);
                  const position = this.getElementPosition(node);

                  this.changes.push({
                    type: 'elementAdded',
                    node: node,
                    xpath: xpath,
                    position: position,
                    timestamp: Date.now(),
                  });
                }
              });
            } else if (mutation.type === 'attributes') {
              // Track attribute changes (like visibility changes)
              const node = mutation.target;
              if (node.nodeType === Node.ELEMENT_NODE) {
                const currentStyle = window.getComputedStyle(node);
                const isVisible =
                  currentStyle.display !== 'none' &&
                  currentStyle.visibility !== 'hidden' &&
                  currentStyle.opacity !== '0';

                if (isVisible) {
                  const xpath = this.getXPath(node);
                  const position = this.getElementPosition(node);

                  this.changes.push({
                    type: 'newlyVisibleElement',
                    node: node,
                    xpath: xpath,
                    position: position,
                    timestamp: Date.now(),
                  });
                }
              }
            }
          });
        });

        // Start observing
        this.observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class', 'hidden'],
        });
      },

      getXPath(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
          return null;
        }

        if (element === document.documentElement) {
          return '/html';
        }

        if (element === document.body) {
          return '/html/body';
        }

        if (!element.parentNode) {
          return null;
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

        const getElementIndex = element => {
          const siblings = Array.from(element.parentNode.children).filter(
            sibling => sibling.tagName === element.tagName
          );
          return siblings.indexOf(element) + 1;
        };

        const buildPath = element => {
          if (element === document.documentElement) {
            return '/html';
          }

          const tagName = element.tagName.toLowerCase();
          const index = getElementIndex(element);

          let pathSegment = `/${tagName}`;
          if (index > 1) {
            pathSegment += `[${index}]`;
          }

          if (element.parentNode && element.parentNode !== document) {
            return buildPath(element.parentNode) + pathSegment;
          }

          return pathSegment;
        };

        try {
          if (element.id) {
            const escapedId = escapeXPath(element.id);
            const xpath = `//*[@id=${escapedId}]`;
            const testResult = document.evaluate(
              xpath,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            );
            if (testResult.singleNodeValue === element) {
              return xpath;
            }
          }

          return buildPath(element);
        } catch (error) {
          console.warn('XPath generation failed:', error.message || error);
          return buildPath(element);
        }
      },

      getElementPosition(element) {
        try {
          const rect = element.getBoundingClientRect();
          const xpath = this.getXPath(element);

          return {
            xpath: xpath,
            boundingRect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
            },
            offsetPosition: {
              offsetTop: element.offsetTop,
              offsetLeft: element.offsetLeft,
              offsetWidth: element.offsetWidth,
              offsetHeight: element.offsetHeight,
            },
          };
        } catch (error) {
          console.warn(
            'Failed to get element position:',
            error.message || error
          );
          return null;
        }
      },

      getChanges() {
        return [...this.changes];
      },
    };

    window.interactionTracker.init();
  }, {});
}

/**
 * Perform interaction on an element
 * @param {Object} elementLocator - Playwright element locator
 * @param {string} interactionType - Type of interaction to perform
 * @returns {Promise<boolean>} Success status
 */
async function _performInteraction(elementLocator, interactionType) {
  try {
    // First, check if element is still valid before interaction
    const isVisible = await elementLocator.isVisible();
    const isEnabled = await elementLocator.isEnabled();

    if (!isVisible) {
      console.warn(
        `Element is not visible, skipping ${interactionType} interaction`
      );
      return false;
    }

    if (!isEnabled) {
      console.warn(
        `Element is disabled, skipping ${interactionType} interaction`
      );
      return false;
    }

    switch (interactionType.toLowerCase()) {
      case 'click':
        // Scroll element into view first to ensure it's clickable
        await elementLocator.scrollIntoViewIfNeeded({ timeout: 3000 });
        await elementLocator.click({ timeout: 5000 });
        break;
      case 'hover':
        await elementLocator.scrollIntoViewIfNeeded({ timeout: 3000 });
        await elementLocator.hover({ timeout: 5000 });
        break;
      case 'focus':
        await elementLocator.scrollIntoViewIfNeeded({ timeout: 3000 });
        await elementLocator.focus({ timeout: 5000 });
        break;
      case 'scroll':
        await elementLocator.scrollIntoViewIfNeeded({ timeout: 5000 });
        break;
      default:
        // Default to click if interaction type is not recognized
        await elementLocator.scrollIntoViewIfNeeded({ timeout: 3000 });
        await elementLocator.click({ timeout: 5000 });
        break;
    }

    // Wait for any animations or delayed content loading
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  } catch (error) {
    // Provide more detailed error information
    let errorDetails = error.message;

    // Common error types and their meanings
    if (error.message.includes('element is not enabled')) {
      errorDetails = 'Element is disabled and cannot be interacted with';
    } else if (error.message.includes('element is not visible')) {
      errorDetails = 'Element is not visible on the page';
    } else if (error.message.includes('timeout')) {
      errorDetails =
        'Interaction timed out after waiting for element to be ready';
    } else if (error.message.includes('not attached')) {
      errorDetails = 'Element was removed from DOM during interaction';
    } else if (error.message.includes('intercepted')) {
      errorDetails = 'Click was intercepted by another element (modal/overlay)';
    }

    console.warn(`❌ ${interactionType} interaction failed: ${errorDetails}`);

    return false;
  }
}

/**
 * Get dynamic content changes from the mutation observer
 * @param {Object} page - Playwright page object
 * @returns {Promise<Array>} Array of dynamic content changes
 */
async function _getDynamicContent(page) {
  return await page.evaluate(() => {
    if (!window.interactionTracker) {
      return [];
    }

    const changes = window.interactionTracker.getChanges();
    return changes.filter(change => {
      // Filter out very small changes or elements without meaningful content
      if (change.node && change.node.textContent) {
        const text = change.node.textContent.trim();
        return text.length > 5; // Only include changes with meaningful text content
      }
      return false;
    });
  }, {});
}

/**
 * Process interactive elements and extract dynamic content revealed by interactions
 * @param {Object} page - Playwright page object
 * @param {Object} interactiveElements - Object containing array of interactive elements
 * @returns {Promise<Array<Object>>} - Array of objects containing dynamic content information
 */
export async function processInteractiveElementsContent(
  page,
  interactiveElements
) {
  try {
    if (
      !interactiveElements ||
      !interactiveElements.elements ||
      !Array.isArray(interactiveElements.elements) ||
      interactiveElements.elements.length === 0
    ) {
      console.log('📝 No interactive elements to process');
      return [];
    }

    console.log(
      `🎯 Processing ${interactiveElements.elements.length} interactive elements`
    );
    const dynamicContentResults = [];

    // Process elements with better error handling and early exits
    for (const element of interactiveElements.elements) {
      try {
        const locator = page.locator(element.selector);
        const elementCount = await locator.count();

        // If selector fails, skip the element entirely
        if (elementCount === 0) {
          console.warn(
            `❌ No elements found for selector: ${element.selector}`
          );
          console.warn('   Skipping element to avoid targeting wrong elements');
          continue;
        }

        for (
          let elementIndex = 0;
          elementIndex < elementCount;
          elementIndex++
        ) {
          const elementLocator = locator.nth(elementIndex);

          // Check if element is visible using locator's isVisible method
          const isVisible = await elementLocator.isVisible();

          if (!isVisible || !(await elementLocator.isEnabled())) {
            continue;
          }

          await _setupMutationObserver(page);

          const interactionSuccess = await _performInteraction(
            elementLocator,
            element.interactionType
          );

          if (!interactionSuccess) {
            continue; // Skip to next element if interaction failed
          }

          // await page.waitForLoadState("networkidle"); // Reduced from default
          const dynamicData = await _getDynamicContent(page);

          if (dynamicData.length > 0) {
            // Prioritize dynamic content by relevance
            const prioritizedContent = dynamicData
              .filter(
                item =>
                  item.node &&
                  (item.node.textContent || item.xpath) &&
                  (item.type === 'elementAdded' ||
                    item.type === 'newlyVisibleElement' ||
                    item.type === 'attributeChanged')
              )
              .sort((a, b) => {
                // Prioritize by change type significance
                const typeWeight = {
                  elementAdded: 5, // High: new element added
                  newlyVisibleElement: 3, // Medium: element became visible
                  attributeChanged: 2, // Lower: attribute changed
                };

                const aWeight = typeWeight[a.type] || 1;
                const bWeight = typeWeight[b.type] || 1;

                if (aWeight !== bWeight) {
                  return bWeight - aWeight;
                }

                // If same type priority, prefer larger content
                return (
                  (b.node.textContent?.length || 0) -
                  (a.node.textContent?.length || 0)
                );
              });

            if (prioritizedContent.length > 0) {
              const bestContent = prioritizedContent[0];

              // Create result object
              // Generate HTML representation for content combining
              let revealedHTML = `<div data-dynamic-content="true" data-xpath="${
                bestContent.xpath
              }">${bestContent.node.textContent || ''}</div>`;

              try {
                // Try to get the actual HTML for better content combining
                revealedHTML =
                  (await page.evaluate(
                    config => {
                      try {
                        const xpathResult = document.evaluate(
                          config.xpath,
                          document,
                          null,
                          XPathResult.FIRST_ORDERED_NODE_TYPE,
                          null
                        );
                        const element = xpathResult.singleNodeValue;
                        return element ? element.outerHTML : null;
                      } catch (error) {
                        console.warn(
                          'Could not retrieve element HTML, using fallback',
                          error
                        );
                        return null;
                      }
                    },
                    { xpath: bestContent.xpath }
                  )) || revealedHTML;
              } catch (error) {
                console.warn(
                  'Could not retrieve element HTML, using fallback',
                  error
                );
              }

              const result = {
                selector: element.selector,
                elementIndex: elementIndex,
                interactionType: element.interactionType,
                changeType: bestContent.type,
                revealedHTML: revealedHTML,
                position: {
                  xpath: bestContent.position?.xpath || bestContent.xpath,
                  boundingRect: bestContent.position?.boundingRect || {
                    x: bestContent.position?.x || 0,
                    y: bestContent.position?.y || 0,
                    width: bestContent.position?.width || 0,
                    height: bestContent.position?.height || 0,
                  },
                  offsetPosition: bestContent.position?.offsetPosition,
                },
                metadata: {
                  totalChanges: dynamicData.length,
                  allChangeTypes: [
                    ...new Set(dynamicData.map(item => item.type)),
                  ],
                  timestamp: bestContent.timestamp,
                },
              };

              dynamicContentResults.push(result);
            }
          }

          if (!(await isScrollingBlocked(page))) {
            // Handle overlay modals where scrolling is still available
            await page.keyboard.press('Escape', { delay: 10 });
            await page.click('html', { delay: 100, force: true });
            await page.waitForTimeout(100);
            continue;
          } else {
            await page.waitForTimeout(100);
          }

          const modals = await findModals(page);
          if (modals.length === 0) {
            continue;
          }

          const modalsClosed = await closeModals(page, modals);

          if (modalsClosed) continue;
        }
      } catch (error) {
        console.error(
          `Failed to process element with selector ${element.selector}:`,
          error
        );
        continue;
      }
    }

    console.log(
      `✅ Collected ${dynamicContentResults.length} dynamic content items`
    );

    // Cleanup tracker to prevent memory leaks
    await cleanup(page);

    return dynamicContentResults;
  } catch (error) {
    await handleError(error, {
      operation: 'processInteractiveElementsContent',
      elementsCount: interactiveElements?.elements?.length || 0,
    });

    // Cleanup tracker to prevent memory leaks
    await cleanup(page).catch(error => {
      console.warn('Failed to cleanup tracker', error);
    });

    return [];
  }
}
