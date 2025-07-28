/**
 * Handle iframes by extracting their content and replacing them in the main page
 * @param {Object} page - Playwright page object
 */
export async function handleIframes(page) {
  const frames = page.frames();

  for (const frame of frames) {
    if (frame === page.mainFrame()) continue;

    try {
      const iframeElement = await frame.frameElement();
      if (!iframeElement) continue;

      const iframeInfo = await iframeElement.evaluate(iframe => {
        const src = iframe.src;
        const srcdoc = iframe.getAttribute('srcdoc');

        if (src) {
          return { type: 'src', url: src, content: null };
        } else if (srcdoc) {
          return { type: 'srcdoc', url: 'inline-srcdoc', content: srcdoc };
        } else {
          return { type: 'inline', url: 'inline', content: null };
        }
      });

      try {
        await frame.waitForLoadState('domcontentloaded', { timeout: 2000 });
      } catch (timeoutError) {
        console.warn(
          `Iframe load timeout for: ${iframeInfo.url}, proceeding anyway...`,
          timeoutError.message
        );
      }

      const frameContent = await frame.evaluate(() => {
        const main = document.querySelector('main');
        const body = document.body;

        if (main && main.innerHTML.trim()) {
          return main.innerHTML;
        }

        if (body) {
          const bodyClone = body.cloneNode(true);
          bodyClone
            .querySelectorAll('script, style, head')
            .forEach(el => el.remove());
          const content = bodyClone.innerHTML.trim();
          if (content) {
            return content;
          }
        }

        const allText = document.body ? document.body.innerText : '';
        if (allText.trim()) {
          return `<p>${allText.trim()}</p>`;
        }

        return '';
      });

      if (frameContent && frameContent.trim().length > 0) {
        await iframeElement.evaluate(
          (iframe, config) => {
            const container = document.createElement('div');
            container.className = 'iframe-content-replacement';
            container.setAttribute(
              'data-original-iframe-src',
              config.iframeUrl || ''
            );
            container.innerHTML = config.content || '';
            iframe.parentNode.replaceChild(container, iframe);
          },
          { content: frameContent, iframeUrl: iframeInfo.url }
        );
      }
    } catch (e) {
      const frameUrl = frame.url();
      console.log(`❌ Cannot access iframe (${frameUrl}): ${e.message}`);

      if (e.message.includes('cross-origin')) {
        console.log('   → Cross-origin restriction detected');
      } else if (e.message.includes('timeout')) {
        console.log('   → Frame loading timeout');
      }
    }
  }
}
