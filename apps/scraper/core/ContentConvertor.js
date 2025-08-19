import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeFormat from 'rehype-format';
import rehypeStringify from 'rehype-stringify';
import rehypeRemark from 'rehype-remark';
import rehypeHighlight from 'rehype-highlight';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { decode } from 'html-entities';

/**
 * Rehype plugin to remove hydration markers and other framework-specific comments
 * @returns {Function} - The rehype plugin function
 */
function rehypeCleanFrameworkMarkers() {
  return tree => {
    visit(tree, 'comment', (node, index, parent) => {
      const comment = node.value;

      const isVueHydrationMarker = /^\s*\[\s*$|^\s*\]\s*$/.test(comment);
      const isReactHydrationMarker = /^\s*\$\?\s*$|^\s*\/\$\?\s*$/.test(
        comment
      );
      const isEmptyComment = /^\s*$/.test(comment);

      // Remove the comment node if it matches any framework marker patterns
      if (isVueHydrationMarker || isReactHydrationMarker || isEmptyComment) {
        parent.children.splice(index, 1);
        return [visit.SKIP, index];
      }
    });
  };
}

/**
 * Rehype plugin to convert relative URLs to absolute URLs
 * @param {string} baseUrl - The base URL to resolve relative URLs against
 * @returns {Function} - The rehype plugin function
 */
function rehypeAbsoluteUrls(baseUrl) {
  return tree => {
    const base = new URL(baseUrl);

    visit(tree, 'element', node => {
      // Handle href attributes (for links)
      if (node.properties && node.properties.href) {
        try {
          const href = node.properties.href;
          // Skip if already absolute URL or anchor link or javascript/mailto
          if (
            !href.startsWith('http') &&
            !href.startsWith('#') &&
            !href.startsWith('javascript:') &&
            !href.startsWith('mailto:') &&
            !href.startsWith('tel:') &&
            !href.startsWith('data:')
          ) {
            node.properties.href = new URL(href, base).toString();
          }
        } catch (error) {
          // If URL construction fails, keep original href
          console.warn(
            `Failed to convert relative URL: ${node.properties.href}`,
            error.message
          );
        }
      }

      // Handle src attributes (for images, iframes, etc.)
      if (node.properties && node.properties.src) {
        try {
          const src = node.properties.src;
          // Skip if already absolute URL or data URL
          if (
            !src.startsWith('http') &&
            !src.startsWith('data:') &&
            !src.startsWith('//')
          ) {
            node.properties.src = new URL(src, base).toString();
          }
        } catch (error) {
          // If URL construction fails, keep original src
          console.warn(
            `Failed to convert relative URL: ${node.properties.src}`,
            error.message
          );
        }
      }
    });
  };
}

/**
 * Convert HTML to Markdown
 * @param {string} htmlContent - The HTML content to convert
 * @param {string} baseUrl - The base URL to resolve relative URLs against
 * @returns {Promise<string>} - The converted markdown content
 */
export async function convertToMarkdown(htmlContent, baseUrl = null) {
  const markdownProcessor = unified()
    .use(rehypeParse)
    .use(rehypeCleanFrameworkMarkers); // Clean framework markers using rehype plugin

  // Add URL conversion plugin only if baseUrl is provided
  if (baseUrl) {
    markdownProcessor.use(rehypeAbsoluteUrls, baseUrl);
  }

  const result = await markdownProcessor
    .use(rehypeHighlight)
    .use(rehypeRemark)
    .use(remarkGfm) // Add GitHub Flavored Markdown support (tables, strikethrough, etc.)
    .use(remarkStringify, {
      // Use clean, consistent markdown formatting
      emphasis: '*', // Use * for emphasis instead of _
      strong: '*', // Use ** for strong instead of __
      bullet: '-', // Use - for unordered lists
      fence: '`', // Use ` for code fences
      fences: true, // Always use fenced code blocks
      incrementListMarker: true,
      listItemIndent: 'one',
      quote: '"',
      rule: '*',
      ruleRepetition: 3,
      setext: false, // Use ATX headings (# ##) instead of setext
      closeAtx: false, // Don't close ATX headings with #
      tightDefinitions: false,
    })
    .process(htmlContent);

  let markdown = result.toString();

  // Post-process to clean up unnecessary escaping in safe contexts
  // This is the correct approach as escaping is necessary for markdown safety,
  // but we can selectively unescape in contexts where it's safe to do so

  // 1. Decode HTML entities first (&#x20; etc.)
  if (markdown.includes('&#')) {
    markdown = decode(markdown);
  }

  // 2. Clean up escaped characters in safe contexts
  // Be more selective about what we unescape to maintain markdown integrity
  markdown = markdown
    // Unescape common punctuation that rarely needs escaping in most content
    .replace(/\\([<>])/g, '$1') // Fix \< and \> to < and >
    .replace(/\\([()[\]])/g, '$1') // Fix \( \) \[ \] to ( ) [ ]
    .replace(/\\([=^+$|])/g, '$1') // Fix \= \^ \+ \$ \| to = ^ + $ |
    // Be careful with * and _ as they have markdown meaning
    // Only unescape them when not in contexts that could be formatting
    .replace(/([^*])\\([*])([^*])/g, '$1$2$3') // Fix \* to * when not surrounded by other *
    .replace(/([^_])\\([_])([^_])/g, '$1$2$3'); // Fix \_ to _ when not surrounded by other _

  return markdown;
}

/**
 * Fix and format HTML
 * @param {string} htmlContent - The HTML content to fix and format
 * @returns {Promise<string>} - The fixed and formatted HTML content
 */
export async function fixAndFormatHTML(htmlContent) {
  const htmlProcessor = await unified()
    .use(rehypeParse)
    .use(rehypeCleanFrameworkMarkers) // Clean framework markers using rehype plugin
    .use(rehypeFormat)
    .use(rehypeStringify)
    .process(htmlContent);

  return htmlProcessor.toString();
}
