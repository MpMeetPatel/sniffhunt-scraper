/**
 * Handle iframes by extracting their content and replacing them in the main page
 * This ensures iframe content is included in the final extracted content
 * @param {Object} page - Playwright page object
 */
export async function handleIframes(page) {
  const frames = page.frames();

  for (const frame of frames) {
    if (frame === page.mainFrame()) continue;

    try {
      const iframeElement = await frame.frameElement();
      if (!iframeElement) continue;

      // Get iframe source information
      const iframeSrc = await iframeElement.evaluate(
        iframe => iframe.src || iframe.getAttribute('srcdoc') || 'inline'
      );

      try {
        await frame.waitForLoadState('domcontentloaded', { timeout: 5000 });
      } catch (timeoutError) {
        console.warn(
          `Iframe load timeout for: ${iframeSrc}, proceeding anyway...`,
          timeoutError.message
        );
      }

      // Extract raw HTML content from iframe without any filtering
      const frameContent = await frame.evaluate(() => {
        // Return the complete raw HTML content
        return document.documentElement.outerHTML;
      }, {});

      // Only replace if we got meaningful content
      if (frameContent && frameContent.trim().length > 0) {
        // Replace iframe with extracted content
        await iframeElement.evaluate(
          (iframe, config) => {
            const container = document.createElement('div');
            container.className = 'iframe-content-replacement';
            container.setAttribute(
              'data-original-iframe-src',
              config.iframeSrc || ''
            );
            container.innerHTML = config.content;
            iframe.parentNode.replaceChild(container, iframe);
          },
          { content: frameContent, iframeSrc }
        );
      } else {
        console.log(`No content found in iframe: ${iframeSrc}`);
      }
    } catch (e) {
      const frameUrl = frame.url();
      console.log(`❌ Cannot access iframe (${frameUrl}): ${e.message}`);

      // Log specific error types for better debugging
      if (e.message.includes('cross-origin')) {
        console.log('   → Cross-origin restriction detected');
      } else if (e.message.includes('timeout')) {
        console.log('   → Frame loading timeout');
      }
    }
  }
}