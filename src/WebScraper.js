import dotenv from 'dotenv';
import { MAX_RETRY_COUNT, RETRY_DELAY } from '../config.js';

// Import all the function modules
import {
  closeBrowser,
  getBrowser,
  getPage,
  initBrowser,
} from './browser-ops/BrowserManager.js';
import { navigateToUrl } from './browser-ops/PageNavigator.js';
import infiniteScrollUntilNoMoreNewNetworkRequest from './browser-ops/PageScroller.js';
import {
  convertAndImproveMarkdownFromHTML,
  convertAndImproveMarkdownFromMarkdown,
} from './core/AIConvertors.js';
import { combineContent } from './core/ContentCombiner.js';
import {
  convertToMarkdown,
  fixAndFormatHTML,
} from './core/ContentConvertor.js';
import { handleIframes } from './core/IframesHandler.js';
import {
  findInteractiveElements,
  processInteractiveElementsContent,
} from './core/InteractiveElementProcessor.js';
import { saveToFile } from './utils/FileManager.js';
import {
  ERROR_CATEGORIES,
  getRetryConfig,
  handleError,
} from './utils/GlobalErrorHandler.js';
import { SimplePerformanceMonitor } from './utils/SimplePerformanceMonitor.js';

dotenv.config({
  quiet: true,
});

// Scraping modes constants
export const SCRAPING_MODES = {
  NORMAL: 'normal',
  BEAST: 'beast',
};

/**
 * Create scraping context with shared state and utilities
 * @returns {Object} Scraping context with shared utilities
 */
function createScrapingContext() {
  return {
    currentMode: SCRAPING_MODES.NORMAL,
    browser: null,
    page: null,
    performanceMonitor: new SimplePerformanceMonitor(),
  };
}

/**
 * Process scraping in normal mode (simple extraction) with optional streaming support
 * @param {Object} context - Scraping context
 * @param {string} outputHtmlFilename - Output filename
 * @param {string} userQuery - Optional user query for focused content extraction
 * @returns {Object} Processing result with enhancedError, markdown, and html
 */
async function processNormalMode(context, outputHtmlFilename, userQuery) {
  const progressCallback = context.progressCallback;

  // Start phase with simple logging
  console.log('🔄 Starting content extraction in normal mode');
  if (progressCallback) {
    progressCallback({
      type: 'phase_start',
      phase: 'content-extraction',
      message: 'Extracting and processing content in normal mode',
    });
  }
  context.performanceMonitor.startPhase('content-extraction');

  // Clean up the page content - same logic as beast mode for consistency
  await context.page.evaluate(() => {
    document
      .querySelectorAll("style, link, script[src^='https://']")
      .forEach(element => element.remove());
  });

  console.log('🧹 Cleaning up page content and extracting HTML');
  if (progressCallback) {
    progressCallback({
      type: 'progress',
      message: 'Cleaning up page content and extracting HTML',
    });
  }

  const rawHTML = await context.page.content();
  await closeBrowser();

  console.log('📝 Converting HTML to markdown');
  if (progressCallback) {
    progressCallback({
      type: 'progress',
      message: 'Converting HTML to markdown',
    });
  }

  const cleanedHTML = await fixAndFormatHTML(rawHTML);

  // Save HTML file only if outputHtmlFilename is provided (for backward compatibility)
  if (outputHtmlFilename) {
    await saveToFile(cleanedHTML, `${outputHtmlFilename}.html`);
  }

  const rawMarkdown = await convertToMarkdown(cleanedHTML);
  let finalMarkdown = rawMarkdown;

  if (userQuery) {
    console.log('🤖 Improving markdown with AI based on user query');
    if (progressCallback) {
      progressCallback({
        type: 'progress',
        message: 'Improving markdown with AI based on user query',
      });
    }
    finalMarkdown = await convertAndImproveMarkdownFromMarkdown(
      rawMarkdown,
      userQuery
    );

    // Save improved markdown file only if outputHtmlFilename is provided
    if (outputHtmlFilename) {
      await saveToFile(finalMarkdown, `${outputHtmlFilename}.md`);
    }
  } else if (outputHtmlFilename) {
    // Save raw markdown file only if outputHtmlFilename is provided
    await saveToFile(rawMarkdown, `${outputHtmlFilename}.raw.md`);
  }

  context.performanceMonitor.endPhase();

  console.log('✅ Content extraction completed successfully');
  if (progressCallback) {
    progressCallback({
      type: 'phase_end',
      phase: 'content-extraction',
      success: true,
      markdownLength: finalMarkdown?.length || 0,
      htmlLength: cleanedHTML?.length || 0,
    });
  }

  return {
    enhancedError: null,
    markdown: finalMarkdown,
    html: cleanedHTML,
  };
}

/**
 * Process scraping in beast mode (advanced extraction with interactive elements) with optional streaming support
 * @param {Object} context - Scraping context
 * @param {string} outputHtmlFilename - Output filename
 * @param {string} userQuery - Optional user query for focused content extraction
 * @returns {Object} Processing result with enhancedError, markdown, and html
 */
async function processBeastMode(context, outputHtmlFilename, userQuery) {
  const progressCallback = context.progressCallback;
  let enhancedError = null;
  let dynamicContents = { contents: [] };

  // Step 1: Find interactive elements that might reveal hidden content
  console.log('🔄 Starting AI element detection phase');
  if (progressCallback) {
    progressCallback({
      type: 'phase_start',
      phase: 'ai-element-detection',
      message: 'Using AI to detect interactive elements',
    });
  }
  context.performanceMonitor.startPhase('AI element detection');

  // Clone HTML content without script tags for AI analysis - improved version with better error handling
  console.log('📄 Starting HTML cloning process...');
  if (progressCallback) {
    progressCallback({
      type: 'log',
      level: 'info',
      message: 'Starting HTML cloning process...',
    });
  }

  let clonedHTML;
  try {
    clonedHTML = await context.page.evaluate(() => {
      try {
        console.log('🌐 Browser: Starting document cloning...');

        // Use document.documentElement instead of document.cloneNode(true)
        // because document.cloneNode(true) doesn't include the HTML element itself
        const sourceElement = document.documentElement || document.body;
        if (!sourceElement) {
          console.error('Browser: No documentElement or body found');
          return null;
        }

        console.log('🌐 Browser: Cloning documentElement...');
        const clonedPage = sourceElement.cloneNode(true);

        if (!clonedPage) {
          console.error('Browser: Cloning returned null');
          return null;
        }

        console.log(
          '🌐 Browser: Document cloned successfully, removing script/link elements...'
        );

        const scriptsAndLinks = clonedPage.querySelectorAll('script, link');
        scriptsAndLinks.forEach((element, index) => {
          try {
            element.remove();
          } catch (removeError) {
            console.warn(`Failed to remove element ${index}:`, removeError);
          }
        });

        const allElements = clonedPage.querySelectorAll('*');

        allElements.forEach((element, index) => {
          try {
            if (
              element.tagName === 'IFRAME' ||
              element.tagName === 'CODE' ||
              element.tagName === 'PRE'
            ) {
              return;
            }

            if (element.tagName !== 'TABLE' && !element.closest('table')) {
              const attrs = Array.from(element.attributes);
              attrs.forEach(attr => {
                try {
                  if (
                    attr.name !== 'class' &&
                    attr.name !== 'id' &&
                    !attr.name.startsWith('data-') &&
                    !attr.name.startsWith('aria-')
                  ) {
                    element.removeAttribute(attr.name);
                  }
                } catch (attrError) {
                  console.warn(
                    `Failed to remove attribute ${attr.name}:`,
                    attrError
                  );
                }
              });
            }
          } catch (elementError) {
            console.warn(`Failed to process element ${index}:`, elementError);
          }
        });

        // Generate the final HTML
        let result;
        if (clonedPage.outerHTML) {
          result = clonedPage.outerHTML;
        } else if (clonedPage.innerHTML) {
          // Fallback: wrap in HTML tags
          result = `<html>${clonedPage.innerHTML}</html>`;
        } else {
          console.error('Browser: No outerHTML or innerHTML available');
          return null;
        }

        console.log(
          '🌐 Browser: HTML generation complete, length:',
          result?.length || 0
        );
        console.log(
          '🌐 Browser: HTML preview:',
          result?.substring(0, 200) || 'no content'
        );
        return result;
      } catch (browserError) {
        console.error(
          'Browser: Error in cloning process:',
          browserError.message
        );
        console.error(
          'Browser: Error stack:',
          browserError.stack?.split('\n').slice(0, 3).join('\n')
        );

        // Emergency fallback: just get the body content
        try {
          console.log('🌐 Browser: Attempting emergency fallback...');
          const bodyContent = document.body ? document.body.innerHTML : '';
          console.log(
            '🌐 Browser: Emergency fallback length:',
            bodyContent.length
          );
          return bodyContent
            ? `<html><body>${bodyContent}</body></html>`
            : null;
        } catch (fallbackError) {
          console.error(
            'Browser: Emergency fallback also failed:',
            fallbackError.message
          );
          console.error(
            'Fallback error details:',
            fallbackError.stack?.split('\n').slice(0, 3).join('\n')
          );
          return null;
        }
      }
    });
  } catch (evaluateError) {
    console.log(`❌ HTML cloning failed: ${evaluateError.message}`);
    if (progressCallback) {
      progressCallback({
        type: 'log',
        level: 'error',
        message: `HTML cloning failed: ${evaluateError.message}`,
      });
    }

    // Final fallback: get page content directly
    try {
      console.log('🔄 Attempting final fallback with page.content()...');
      if (progressCallback) {
        progressCallback({
          type: 'log',
          level: 'info',
          message: 'Attempting final fallback with page.content()...',
        });
      }
      clonedHTML = await context.page.content();
      console.log(
        `📄 Final fallback successful, length: ${clonedHTML?.length || 0}`
      );
      if (progressCallback) {
        progressCallback({
          type: 'log',
          level: 'info',
          message: `Final fallback successful, length: ${clonedHTML?.length || 0}`,
        });
      }
    } catch (finalError) {
      console.log(`❌ Final fallback also failed: ${finalError.message}`);
      if (progressCallback) {
        progressCallback({
          type: 'log',
          level: 'error',
          message: `Final fallback also failed: ${finalError.message}`,
        });
      }
      clonedHTML = '';
    }
  }

  console.log(
    '🔍 Analyzing page structure with AI to find interactive elements'
  );
  if (progressCallback) {
    progressCallback({
      type: 'progress',
      message: 'Analyzing page structure with AI to find interactive elements',
    });
  }

  let interactiveElements;
  if (clonedHTML.length > 800000) {
    // Greater than 800K characters, skip AI analysis and fall back to normal mode (for gemini-2.5-flash it's safe to have 1M Context lenght, but to avoid extra junki websites, we are using 800K as a safe limit)
    console.log(
      `🔄 Skipping AI analysis for large HTML content, HTML length: ${clonedHTML.length} characters`
    );
    if (progressCallback) {
      progressCallback({
        type: 'log',
        level: 'info',
        message: `Skipping AI analysis for large HTML content, HTML length: ${clonedHTML.length} characters`,
      });
    }
    context.performanceMonitor.endPhase();
    return await processNormalMode(context, outputHtmlFilename, userQuery);
  } else {
    console.log(`📄 Analyzing ${clonedHTML.length} characters of HTML content`);
    if (progressCallback) {
      progressCallback({
        type: 'log',
        level: 'info',
        message: `Analyzing ${clonedHTML.length} characters of HTML content`,
      });
    }

    try {
      interactiveElements = await findInteractiveElements(
        clonedHTML,
        userQuery,
        progressCallback
      );
    } catch (error) {
      const handledError = await handleError(error, {
        operation: 'findInteractiveElements',
        url: context.page?.url?.() || 'unknown',
        userQuery,
      });

      if (!handledError.shouldRetry) {
        enhancedError = handledError;
        interactiveElements = { elements: [] };
      } else {
        throw handledError; // Allow retry for retryable errors
      }
    }
  }

  context.performanceMonitor.endPhase();
  console.log(
    `✅ AI element detection completed, found ${interactiveElements.elements?.length || 0} elements`
  );
  if (progressCallback) {
    progressCallback({
      type: 'phase_end',
      phase: 'ai-element-detection',
      success: true,
      elementsFound: interactiveElements.elements?.length || 0,
    });
  }

  // Step 2: Process interactive elements to reveal dynamic content
  console.log('🔄 Starting dynamic content extraction phase');
  if (progressCallback) {
    progressCallback({
      type: 'phase_start',
      phase: 'dynamic-content-extraction',
      message: 'Processing interactive elements to reveal hidden content',
    });
  }
  context.performanceMonitor.startPhase('interactive elements processing');

  if (interactiveElements.elements.length > 0) {
    try {
      if (progressCallback) {
        progressCallback({
          type: 'progress',
          message: `Processing ${interactiveElements.elements.length} interactive elements`,
        });
      }

      dynamicContents = await processInteractiveElementsContent(
        context.page,
        interactiveElements
      );
    } catch (error) {
      const handledError = await handleError(error, {
        operation: 'processInteractiveElementsContent',
        url: context.page?.url?.() || 'unknown',
        elementsCount: interactiveElements.elements.length,
        userQuery,
      });

      if (!handledError.shouldRetry) {
        console.log('⚠️ Continuing without dynamic content extraction...');
        if (progressCallback) {
          progressCallback({
            type: 'log',
            level: 'warn',
            message: 'Continuing without dynamic content extraction...',
          });
        }
        enhancedError = handledError;
      } else {
        throw handledError;
      }
    }
  }

  context.performanceMonitor.endPhase();
  console.log(
    `✅ Dynamic content extraction completed, found ${dynamicContents.contents?.length || 0} pieces`
  );
  if (progressCallback) {
    progressCallback({
      type: 'phase_end',
      phase: 'dynamic-content-extraction',
      success: true,
      dynamicContentPieces: dynamicContents.contents?.length || 0,
    });
  }

  // Step 3: Combine main content with dynamic content
  console.log('🔄 Starting content processing phase');
  if (progressCallback) {
    progressCallback({
      type: 'phase_start',
      phase: 'content-processing',
      message: 'Combining main content with dynamic content',
    });
  }
  context.performanceMonitor.startPhase('content processing');

  console.log('🔗 Combining main content with extracted dynamic content');
  if (progressCallback) {
    progressCallback({
      type: 'progress',
      message: 'Combining main content with extracted dynamic content',
    });
  }
  const combinedHtml = await combineContent(context.page, dynamicContents);
  await closeBrowser();

  console.log('🧹 Cleaning and formatting HTML content');
  if (progressCallback) {
    progressCallback({
      type: 'progress',
      message: 'Cleaning and formatting HTML content',
    });
  }
  const cleanedHTML = await fixAndFormatHTML(combinedHtml);

  // Save HTML file only if outputHtmlFilename is provided (for backward compatibility)
  if (outputHtmlFilename) {
    await saveToFile(cleanedHTML, `${outputHtmlFilename}.html`);
  }

  // Step 4: Convert to markdown and improve with AI
  let finalMarkdown;
  if (userQuery) {
    console.log(
      '🤖 Converting to markdown and improving with AI based on user query'
    );
    if (progressCallback) {
      progressCallback({
        type: 'progress',
        message:
          'Converting to markdown and improving with AI based on user query',
      });
    }
    finalMarkdown = await convertAndImproveMarkdownFromHTML(
      cleanedHTML,
      userQuery,
      progressCallback
    );

    // Save improved markdown file only if outputHtmlFilename is provided
    if (outputHtmlFilename) {
      await saveToFile(finalMarkdown, `${outputHtmlFilename}.md`);
    }
  } else {
    console.log('📝 Converting HTML to markdown');
    if (progressCallback) {
      progressCallback({
        type: 'progress',
        message: 'Converting HTML to markdown',
      });
    }
    finalMarkdown = await convertToMarkdown(cleanedHTML);

    // Save raw markdown file only if outputHtmlFilename is provided
    if (outputHtmlFilename) {
      await saveToFile(finalMarkdown, `${outputHtmlFilename}.raw.md`);
    }
  }

  context.performanceMonitor.endPhase();
  console.log('✅ Content processing completed successfully');
  if (progressCallback) {
    progressCallback({
      type: 'phase_end',
      phase: 'content-processing',
      success: true,
      markdownLength: finalMarkdown?.length || 0,
      htmlLength: cleanedHTML?.length || 0,
    });
  }

  return {
    enhancedError,
    markdown: finalMarkdown,
    html: cleanedHTML,
  };
}

/**
 * Main scraper function that orchestrates the entire process
 * @param {string} url - The URL to scrape
 * @param {string} outputHtmlFilename - The filename to save the result as (default: "scraped")
 * @param {string} userQuery - Optional user query for focused content extraction
 * @param {string} mode - Scraping mode (NORMAL or BEAST, default: BEAST)
 * @returns {Promise<boolean>} - Success status
 */
export async function scrape(
  url,
  outputHtmlFilename = 'scraped',
  userQuery = '',
  mode = SCRAPING_MODES.NORMAL
) {
  let retryCount = 0;
  let success = false;
  let enhancedError = null;
  let context = null;

  while (retryCount < MAX_RETRY_COUNT && !success) {
    try {
      // Create scraping context
      context = createScrapingContext();
      context.currentMode = mode;

      console.log(`🔄 Scraping ${url} (attempt ${retryCount + 1})`);

      // Start performance monitoring
      context.performanceMonitor.start();

      // Step 1: Initialize browser and get page
      context.performanceMonitor.startPhase('browser setup');
      const browserInitialized = await initBrowser();
      if (!browserInitialized) {
        throw new Error('Failed to initialize browser');
      }

      context.browser = getBrowser();
      context.page = getPage();

      // Set browser context for enhanced monitoring
      context.performanceMonitor.setBrowserContext(context.page);

      context.performanceMonitor.endPhase();

      // Step 2: Navigate to URL and wait for page to stabilize
      context.performanceMonitor.startPhase('page loading');
      await navigateToUrl(context.page, url);
      await infiniteScrollUntilNoMoreNewNetworkRequest(context.page);
      context.performanceMonitor.endPhase();

      // Step 3: Process iframes by extracting their content
      context.performanceMonitor.startPhase('iframe processing');
      await handleIframes(context.page);
      context.performanceMonitor.endPhase();

      let result;
      if (context.currentMode === SCRAPING_MODES.NORMAL) {
        result = await processNormalMode(
          context,
          outputHtmlFilename,
          userQuery
        );
      } else {
        result = await processBeastMode(context, outputHtmlFilename, userQuery);
      }
      enhancedError = result.enhancedError;

      success = true;

      // Stop performance monitoring
      context.performanceMonitor.stop();

      // Show final status
      if (enhancedError) {
        console.log(
          `⚠️ Scraping completed with limitations: ${enhancedError.userMessage}`
        );
      } else {
        console.log('✅ Scraping completed successfully with all features!');
      }
    } catch (error) {
      // Handle the error with our global error handler
      const handledError = await handleError(error, {
        operation: 'scrape',
        url,
        attempt: retryCount + 1,
        mode: context?.currentMode || mode,
        outputFile: outputHtmlFilename,
      });

      // Check if this error should stop retries
      if (
        !handledError.shouldRetry ||
        handledError.category === ERROR_CATEGORIES.RATE_LIMIT
      ) {
        console.log(
          `\n🛑 Scraping stopped - Error ID: ${handledError.stackId}`
        );
        break; // Don't retry for auth, rate limit, or non-retryable errors
      }

      retryCount++;

      if (retryCount < MAX_RETRY_COUNT) {
        const retryConfig = getRetryConfig(handledError);
        const delay =
          retryConfig.strategy === 'exponential'
            ? RETRY_DELAY * Math.pow(2, retryCount - 1)
            : RETRY_DELAY;

        console.log(
          `🔄 Retrying in ${delay}ms... (attempt ${
            retryCount + 1
          }/${MAX_RETRY_COUNT})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.log(
          `\n❌ Maximum retry attempts (${MAX_RETRY_COUNT}) reached - Error ID: ${handledError.stackId}`
        );
      }
    } finally {
      // Always close browser in finally block
      if (context && context.browser) {
        await closeBrowser();
      }

      // Stop performance monitoring if it was started
      if (
        context &&
        context.performanceMonitor &&
        context.performanceMonitor.monitoringInterval
      ) {
        context.performanceMonitor.stop();
      }
    }
  }

  return success;
}

/**
 * Streaming-enabled scraper function
 * @param {string} url - The URL to scrape
 * @param {string} outputHtmlFilename - The filename identifier (default: "scraped")
 * @param {string} userQuery - Optional user query for focused content extraction
 * @param {string} mode - Scraping mode (NORMAL or BEAST, default: BEAST)
 * @param {Function} progressCallback - Optional callback for streaming progress updates
 * @returns {Promise<Object>} - Structured result with markdown and HTML content
 */
export async function scrapeWithStreaming(
  url,
  outputHtmlFilename = 'scraped',
  userQuery = '',
  mode = SCRAPING_MODES.NORMAL,
  progressCallback = null
) {
  const startTime = Date.now();
  let retryCount = 0;
  let success = false;
  let enhancedError = null;
  let context = null;
  let finalMarkdown = null;
  let finalHtml = null;

  // Helper function to log with streaming support
  const logWithStreaming = (message, level = 'info') => {
    console.log(
      `${level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️'} ${message}`
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

  try {
    logWithStreaming(`Starting scraping process for ${url}`, 'info');

    while (retryCount < MAX_RETRY_COUNT && !success) {
      try {
        logWithStreaming(
          `Scraping ${url} (attempt ${retryCount + 1}/${MAX_RETRY_COUNT})`,
          'info'
        );

        // Create scraping context
        context = createScrapingContext();
        context.currentMode = mode;
        context.progressCallback = progressCallback;

        // Start performance monitoring
        context.performanceMonitor.start();

        // Step 1: Initialize browser and get page
        console.log('🔄 Initializing browser and setting up page');
        if (progressCallback) {
          progressCallback({
            type: 'phase_start',
            phase: 'browser-setup',
            message: 'Initializing browser and setting up page',
          });
        }
        context.performanceMonitor.startPhase('browser setup');

        const browserInitialized = await initBrowser();
        if (!browserInitialized) {
          throw new Error('Failed to initialize browser');
        }

        context.browser = getBrowser();
        context.page = getPage();

        // Set browser context for enhanced monitoring
        context.performanceMonitor.setBrowserContext(context.page);
        context.performanceMonitor.endPhase();
        if (progressCallback) {
          progressCallback({
            type: 'phase_end',
            phase: 'browser-setup',
            success: true,
            browser: 'initialized',
          });
        }

        // Step 2: Navigate to URL and wait for page to stabilize
        console.log(`🔄 Navigating to ${url} and waiting for page to load`);
        if (progressCallback) {
          progressCallback({
            type: 'phase_start',
            phase: 'page-loading',
            message: `Navigating to ${url} and waiting for page to load`,
          });
        }
        context.performanceMonitor.startPhase('page loading');

        await navigateToUrl(context.page, url);
        console.log(
          '📄 Page loaded, performing infinite scroll to load dynamic content'
        );
        if (progressCallback) {
          progressCallback({
            type: 'progress',
            message:
              'Page loaded, performing infinite scroll to load dynamic content',
          });
        }

        await infiniteScrollUntilNoMoreNewNetworkRequest(context.page);
        context.performanceMonitor.endPhase();
        console.log('✅ Page loading completed successfully');
        if (progressCallback) {
          progressCallback({
            type: 'phase_end',
            phase: 'page-loading',
            success: true,
            url: url,
          });
        }

        // Step 3: Process iframes by extracting their content
        console.log('🔄 Processing iframe content');
        if (progressCallback) {
          progressCallback({
            type: 'phase_start',
            phase: 'iframe-processing',
            message: 'Processing iframe content',
          });
        }
        context.performanceMonitor.startPhase('iframe processing');

        await handleIframes(context.page);
        context.performanceMonitor.endPhase();
        console.log('✅ Iframe processing completed successfully');
        if (progressCallback) {
          progressCallback({
            type: 'phase_end',
            phase: 'iframe-processing',
            success: true,
          });
        }

        // Step 4: Execute scraping based on mode
        let scrapingResult;
        if (context.currentMode === SCRAPING_MODES.NORMAL) {
          scrapingResult = await processNormalMode(
            context,
            null, // Don't save files in streaming mode
            userQuery
          );
        } else {
          scrapingResult = await processBeastMode(
            context,
            null, // Don't save files in streaming mode
            userQuery
          );
        }

        enhancedError = scrapingResult.enhancedError;
        finalMarkdown = scrapingResult.markdown;
        finalHtml = scrapingResult.html;

        success = true;

        // Stop performance monitoring
        context.performanceMonitor.stop();

        // Log final status
        if (enhancedError) {
          logWithStreaming('Scraping completed with limitations', 'warn');
          logWithStreaming(
            `Enhanced features: ${enhancedError.userMessage}`,
            'warn'
          );
        } else {
          logWithStreaming(
            'Scraping completed successfully with all features!',
            'info'
          );
        }
      } catch (error) {
        // Log the error
        logWithStreaming(`Error: ${error.message}`, 'error');
        if (progressCallback) {
          progressCallback({
            type: 'error',
            message: error.message,
            url,
            attempt: retryCount + 1,
            mode: context?.currentMode || mode,
            timestamp: new Date().toISOString(),
          });
        }

        // Handle the error with our global error handler
        const handledError = await handleError(error, {
          operation: 'scrapeWithStreaming',
          url,
          attempt: retryCount + 1,
          mode: context?.currentMode || mode,
          outputFile: outputHtmlFilename,
        });

        retryCount++;

        if (retryCount < MAX_RETRY_COUNT) {
          const retryConfig = getRetryConfig(handledError);
          const delay =
            retryConfig.strategy === 'exponential'
              ? RETRY_DELAY * Math.pow(2, retryCount - 1)
              : RETRY_DELAY;

          logWithStreaming(
            `Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRY_COUNT})`,
            'info'
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logWithStreaming(
            `Maximum retry attempts (${MAX_RETRY_COUNT}) reached - Error ID: ${handledError.stackId}`,
            'error'
          );
        }
      } finally {
        // Always close browser in finally block
        if (context && context.browser) {
          await closeBrowser();
        }

        // Stop performance monitoring if it was started
        if (
          context &&
          context.performanceMonitor &&
          context.performanceMonitor.monitoringInterval
        ) {
          context.performanceMonitor.stop();
        }
      }
    }

    // Complete the streaming process
    const processingTime = Date.now() - startTime;
    const result = {
      success,
      markdown: finalMarkdown,
      html: finalHtml,
      processingTime,
      enhancedError,
    };

    console.log(`🎉 Streaming completed successfully (${processingTime}ms)`);
    if (progressCallback) {
      progressCallback({
        type: 'stream_complete',
        ...result,
        timestamp: new Date().toISOString(),
      });
    }
    return result;
  } catch (error) {
    logWithStreaming(
      `Fatal error in scraping process: ${error.message}`,
      'error'
    );

    return {
      success: false,
      markdown: null,
      html: null,
      processingTime: Date.now() - startTime,
      error: error.message,
      enhancedError: null,
    };
  }
}
